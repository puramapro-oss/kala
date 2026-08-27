-- 0004_wallet.sql — Table wallets écosystème KOSHA (EX-085/086/087)
-- Appliqué par: docker exec -i supabase-db psql -U supabase_admin -d postgres
-- Date: 2026-08-07
--
-- Architecture: schéma partagé purama_marketplace, isolation par app_id
-- RLS: profil voit SON solde uniquement, service_role seul écrit (crédits/débits)
-- Atomicité débit: UPDATE WHERE solde >= montant (PIEGES.md §1 race condition)

SET search_path TO purama_marketplace, public;

-- Table wallets (1 ligne par profil par app)
CREATE TABLE IF NOT EXISTS purama_marketplace.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL REFERENCES purama_marketplace.apps(app_id) ON DELETE CASCADE,
  profil_id uuid NOT NULL REFERENCES purama_marketplace.profils(id) ON DELETE CASCADE,
  solde_cents integer NOT NULL DEFAULT 0 CHECK (solde_cents >= 0),
  maj_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, profil_id)
);

-- Index lookup rapide par profil (lecture solde)
CREATE INDEX IF NOT EXISTS idx_wallets_profil ON purama_marketplace.wallets(app_id, profil_id);

-- RLS activé
ALTER TABLE purama_marketplace.wallets ENABLE ROW LEVEL SECURITY;

-- Policy SELECT : profil voit SON wallet uniquement
CREATE POLICY wallets_select ON purama_marketplace.wallets
  FOR SELECT
  USING (
    app_id = current_app_id()
    AND profil_id = mon_profil_id()
  );

-- Policies INSERT/UPDATE/DELETE : service_role uniquement (crédits/débits API contrôlés)
-- authenticated ne peut jamais manipuler son solde directement
CREATE POLICY wallets_insert ON purama_marketplace.wallets
  FOR INSERT
  WITH CHECK (false); -- Aucun utilisateur authentifié ne peut INSERT (service_role bypass RLS)

CREATE POLICY wallets_update ON purama_marketplace.wallets
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY wallets_delete ON purama_marketplace.wallets
  FOR DELETE
  USING (false);

-- GRANT privilèges : authenticated peut SELECT uniquement, service_role full
GRANT SELECT ON purama_marketplace.wallets TO authenticated;
GRANT ALL ON purama_marketplace.wallets TO service_role;

-- Trigger maj_le auto
CREATE OR REPLACE FUNCTION purama_marketplace.update_wallets_maj_le()
RETURNS TRIGGER AS $$
BEGIN
  NEW.maj_le = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallets_maj_le_trigger
BEFORE UPDATE ON purama_marketplace.wallets
FOR EACH ROW
EXECUTE FUNCTION purama_marketplace.update_wallets_maj_le();

-- Historique mouvements wallet (pour audit + blocage futur 30j primes BK-015)
-- Catégories: 'cashback_karma' (split 50%), 'retrait', 'prime_parrainage' (V1.1), 'remboursement'
CREATE TABLE IF NOT EXISTS purama_marketplace.wallet_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL REFERENCES purama_marketplace.apps(app_id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES purama_marketplace.wallets(id) ON DELETE CASCADE,
  profil_id uuid NOT NULL, -- dénormalisé pour perfs
  montant_cents integer NOT NULL, -- positif = crédit, négatif = débit
  categorie text NOT NULL CHECK (categorie IN ('cashback_karma', 'retrait', 'prime_parrainage', 'remboursement')),
  reservation_id uuid, -- référence garde source (si cashback)
  cree_le timestamptz NOT NULL DEFAULT now(),
  disponible_le timestamptz, -- NULL = immédiat, sinon date déblocage (future BK-015 primes parrainage 30j)
  description text
);

CREATE INDEX IF NOT EXISTS idx_wallet_mouvements_wallet ON purama_marketplace.wallet_mouvements(wallet_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_mouvements_profil ON purama_marketplace.wallet_mouvements(app_id, profil_id, cree_le DESC);

-- RLS wallet_mouvements
ALTER TABLE purama_marketplace.wallet_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_mouvements_select ON purama_marketplace.wallet_mouvements
  FOR SELECT
  USING (
    app_id = current_app_id()
    AND profil_id = mon_profil_id()
  );

CREATE POLICY wallet_mouvements_insert ON purama_marketplace.wallet_mouvements
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY wallet_mouvements_update ON purama_marketplace.wallet_mouvements
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY wallet_mouvements_delete ON purama_marketplace.wallet_mouvements
  FOR DELETE
  USING (false);

GRANT SELECT ON purama_marketplace.wallet_mouvements TO authenticated;
GRANT ALL ON purama_marketplace.wallet_mouvements TO service_role;

-- Fonction helper crédit wallet (upsert atomique)
-- Utilisée par api/internal/stripe-event pour créditer split.partUsers
CREATE OR REPLACE FUNCTION purama_marketplace.credit_wallet(
  p_app_id text,
  p_profil_id uuid,
  p_montant_cents integer,
  p_categorie text,
  p_reservation_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid -- retourne wallet_id
LANGUAGE plpgsql
SECURITY DEFINER -- s'exécute en tant que supabase_admin, bypass RLS
AS $$
DECLARE
  v_wallet_id uuid;
  v_mouvement_id uuid;
BEGIN
  -- Upsert wallet (créer si n'existe pas)
  INSERT INTO purama_marketplace.wallets (app_id, profil_id, solde_cents)
  VALUES (p_app_id, p_profil_id, p_montant_cents)
  ON CONFLICT (app_id, profil_id)
  DO UPDATE SET
    solde_cents = purama_marketplace.wallets.solde_cents + EXCLUDED.solde_cents,
    maj_le = now()
  RETURNING id INTO v_wallet_id;

  -- Log mouvement
  INSERT INTO purama_marketplace.wallet_mouvements (
    app_id, wallet_id, profil_id, montant_cents, categorie, reservation_id, description, disponible_le
  ) VALUES (
    p_app_id, v_wallet_id, p_profil_id, p_montant_cents, p_categorie, p_reservation_id, p_description,
    NULL -- disponible immédiatement (future BK-015 ajoutera now() + interval '30 days' pour primes)
  ) RETURNING id INTO v_mouvement_id;

  RETURN v_wallet_id;
END;
$$;

-- Fonction helper débit wallet atomique (PIEGES.md §1 race condition)
-- Retourne NULL si solde insuffisant, wallet_id sinon
CREATE OR REPLACE FUNCTION purama_marketplace.debit_wallet(
  p_app_id text,
  p_profil_id uuid,
  p_montant_cents integer, -- montant à débiter (positif)
  p_categorie text,
  p_description text DEFAULT NULL
)
RETURNS uuid -- retourne wallet_id si succès, NULL si solde insuffisant
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id uuid;
  v_rows_affected integer;
BEGIN
  -- UPDATE atomique avec vérif solde en WHERE (1 seule requête)
  UPDATE purama_marketplace.wallets
  SET
    solde_cents = solde_cents - p_montant_cents,
    maj_le = now()
  WHERE
    app_id = p_app_id
    AND profil_id = p_profil_id
    AND solde_cents >= p_montant_cents -- condition atomique
  RETURNING id INTO v_wallet_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    -- Solde insuffisant ou wallet inexistant
    RETURN NULL;
  END IF;

  -- Log mouvement (montant négatif = débit)
  INSERT INTO purama_marketplace.wallet_mouvements (
    app_id, wallet_id, profil_id, montant_cents, categorie, description, disponible_le
  ) VALUES (
    p_app_id, v_wallet_id, p_profil_id, -p_montant_cents, p_categorie, p_description, NULL
  );

  RETURN v_wallet_id;
END;
$$;

-- Commentaires EX-ID traçabilité
COMMENT ON TABLE purama_marketplace.wallets IS 'EX-085/086/087: Wallet KOSHA écosystème, solde par profil, RLS lecture seule profil, écriture service_role';
COMMENT ON FUNCTION purama_marketplace.credit_wallet IS 'EX-087: Crédite wallet (upsert atomique), appelé par stripe-event split 50% users';
COMMENT ON FUNCTION purama_marketplace.debit_wallet IS 'EX-085: Débit atomique WHERE solde >= montant (PIEGES.md §1 race condition), retourne NULL si insuffisant';
