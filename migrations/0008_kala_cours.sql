-- 0008_kala_cours.sql — KALA : cours de musique/loisirs à domicile (app_id 'kala')
-- Schéma partagé purama_marketplace (D-007) — colonnes+tables KALA uniquement, 0 changement PASHU.
-- Appliquée par: docker exec -i supabase-db psql -U supabase_admin -d postgres
-- JAMAIS psql -h localhost -p 5432 (pooler Supavisor — PIEGES §2)
-- Ordre PIEGES L213 : apps → colonnes/constraints → tables → index → GRANT → RLS. Idempotent.

SET search_path TO purama_marketplace, public;

-- 1. Enregistrement de l'app (idempotent)
INSERT INTO purama_marketplace.apps (app_id, nom)
VALUES ('kala', 'KALA') ON CONFLICT (app_id) DO NOTHING;

-- 2. Prestataires : vidéo 30s obligatoire à la publication (EX-001) — contrainte applicative,
--    la colonne permet le brouillon sans vidéo. Privilege UPDATE colonne ajouté (EX-020 pattern).
ALTER TABLE purama_marketplace.prestataires
  ADD COLUMN IF NOT EXISTS video_30s_url text;
ALTER TABLE purama_marketplace.prestataires
  DROP CONSTRAINT IF EXISTS prestataires_video_coherente;
ALTER TABLE purama_marketplace.prestataires
  ADD CONSTRAINT prestataires_video_coherente CHECK (
    app_id <> 'kala'
    OR statut_verification <> 'verifie'
    OR (video_30s_url IS NOT NULL AND video_30s_url <> '')
  ) NOT VALID;
GRANT UPDATE (video_30s_url) ON purama_marketplace.prestataires TO authenticated;

-- 3. Reservations : mineur + compte parent (EX-005)
ALTER TABLE purama_marketplace.reservations
  ADD COLUMN IF NOT EXISTS eleve_mineur boolean NOT NULL DEFAULT false;
ALTER TABLE purama_marketplace.reservations
  ADD COLUMN IF NOT EXISTS compte_parent_id uuid
    REFERENCES purama_marketplace.profils(id) ON DELETE SET NULL;
ALTER TABLE purama_marketplace.reservations
  DROP CONSTRAINT IF EXISTS reservations_parent_si_mineur;
ALTER TABLE purama_marketplace.reservations
  ADD CONSTRAINT reservations_parent_si_mineur
    CHECK (NOT eleve_mineur OR compte_parent_id IS NOT NULL);

-- 4. Enregistrements 30s de la timeline (EX-003) — privés par défaut, aucun accès tiers en RLS.
CREATE TABLE IF NOT EXISTS purama_marketplace.enregistrements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id         text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  reservation_id uuid NOT NULL REFERENCES purama_marketplace.reservations(id) ON DELETE CASCADE,
  url            text NOT NULL CHECK (url <> ''),
  duree_s        integer NOT NULL CHECK (duree_s > 0 AND duree_s <= 300),
  prive          boolean NOT NULL DEFAULT true,
  cree_le        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enregistrements_app_reservation_idx
  ON purama_marketplace.enregistrements (app_id, reservation_id);

-- 5. GRANT explicites (défaut déjà couvert par ALTER DEFAULT PRIVILEGES 0002 — redondance volontaire)
GRANT SELECT, INSERT, UPDATE, DELETE ON purama_marketplace.enregistrements TO authenticated;
GRANT ALL ON purama_marketplace.enregistrements TO service_role;

-- 6. RLS — parties de la réservation uniquement : client (élève/parent payeur), compte parent si mineur,
--    prof titulaire. Un tiers quelconque ne voit RIEN, même prive=false (partage = lien signé applicatif).
ALTER TABLE purama_marketplace.enregistrements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enregistrements_select ON purama_marketplace.enregistrements;
CREATE POLICY enregistrements_select ON purama_marketplace.enregistrements FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations
      WHERE app_id = purama_marketplace.current_app_id()
        AND (client_profil_id = purama_marketplace.mon_profil_id()
          OR compte_parent_id = purama_marketplace.mon_profil_id()
          OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires
              WHERE profil_id = purama_marketplace.mon_profil_id()))));

-- Insertion par le prof de la réservation uniquement (timeline = ce que le prof capture au cours)
DROP POLICY IF EXISTS enregistrements_insert ON purama_marketplace.enregistrements;
CREATE POLICY enregistrements_insert ON purama_marketplace.enregistrements FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND prive = true  -- privé par défaut, le partage est une action explicite ultérieure du titulaire
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations
      WHERE app_id = purama_marketplace.current_app_id()
        AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires
            WHERE profil_id = purama_marketplace.mon_profil_id())));

-- Partage (prive=false) = décision du titulaire : client payeur ou compte parent si mineur (EX-003)
DROP POLICY IF EXISTS enregistrements_update ON purama_marketplace.enregistrements;
CREATE POLICY enregistrements_update ON purama_marketplace.enregistrements FOR UPDATE TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations
      WHERE app_id = purama_marketplace.current_app_id()
        AND (client_profil_id = purama_marketplace.mon_profil_id()
          OR compte_parent_id = purama_marketplace.mon_profil_id())))
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations
      WHERE app_id = purama_marketplace.current_app_id()
        AND (client_profil_id = purama_marketplace.mon_profil_id()
          OR compte_parent_id = purama_marketplace.mon_profil_id())));

-- Suppression par le titulaire ou le prof
DROP POLICY IF EXISTS enregistrements_delete ON purama_marketplace.enregistrements;
CREATE POLICY enregistrements_delete ON purama_marketplace.enregistrements FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations
      WHERE app_id = purama_marketplace.current_app_id()
        AND (client_profil_id = purama_marketplace.mon_profil_id()
          OR compte_parent_id = purama_marketplace.mon_profil_id()
          OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires
              WHERE profil_id = purama_marketplace.mon_profil_id()))));
