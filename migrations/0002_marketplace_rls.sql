-- 0002_marketplace_rls.sql — PASHU RLS + GRANT + privileges colonne
-- Appliquée par: docker exec -i supabase-db psql -U supabase_admin -d postgres

SET search_path TO purama_marketplace, public;

-- GRANT USAGE schéma
GRANT USAGE ON SCHEMA purama_marketplace TO authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA purama_marketplace FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA purama_marketplace TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA purama_marketplace TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA purama_marketplace
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Privilèges colonne (EX-020, EX-079) sur prestataires : colonnes protégées
REVOKE UPDATE ON purama_marketplace.prestataires FROM authenticated;
GRANT  UPDATE (titre, presentation, commune, code_postal, latitude, longitude,
               rayon_km, adresse_exacte, maj_le)
  ON purama_marketplace.prestataires TO authenticated;

-- RLS policies : profils
ALTER TABLE purama_marketplace.profils ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profils_select ON purama_marketplace.profils;
CREATE POLICY profils_select ON purama_marketplace.profils FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS profils_insert ON purama_marketplace.profils;
CREATE POLICY profils_insert ON purama_marketplace.profils FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS profils_update ON purama_marketplace.profils;
CREATE POLICY profils_update ON purama_marketplace.profils FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS profils_delete ON purama_marketplace.profils;
CREATE POLICY profils_delete ON purama_marketplace.profils FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());

-- RLS policies : prestataires
ALTER TABLE purama_marketplace.prestataires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prestataires_select ON purama_marketplace.prestataires;
CREATE POLICY prestataires_select ON purama_marketplace.prestataires FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS prestataires_insert ON purama_marketplace.prestataires;
CREATE POLICY prestataires_insert ON purama_marketplace.prestataires FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS prestataires_update ON purama_marketplace.prestataires;
CREATE POLICY prestataires_update ON purama_marketplace.prestataires FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS prestataires_delete ON purama_marketplace.prestataires;
CREATE POLICY prestataires_delete ON purama_marketplace.prestataires FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());

-- RLS policies : prestations
ALTER TABLE purama_marketplace.prestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prestations_select ON purama_marketplace.prestations;
CREATE POLICY prestations_select ON purama_marketplace.prestations FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()));
DROP POLICY IF EXISTS prestations_insert ON purama_marketplace.prestations;
CREATE POLICY prestations_insert ON purama_marketplace.prestations FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()));
DROP POLICY IF EXISTS prestations_update ON purama_marketplace.prestations;
CREATE POLICY prestations_update ON purama_marketplace.prestations FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id()
    AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()))
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()));
DROP POLICY IF EXISTS prestations_delete ON purama_marketplace.prestations;
CREATE POLICY prestations_delete ON purama_marketplace.prestations FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()));

-- RLS policies : animaux
ALTER TABLE purama_marketplace.animaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS animaux_select ON purama_marketplace.animaux;
CREATE POLICY animaux_select ON purama_marketplace.animaux FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND (profil_id = purama_marketplace.mon_profil_id()
      OR id IN (SELECT animal_id FROM purama_marketplace.reservation_animaux ra
                JOIN purama_marketplace.reservations r ON ra.reservation_id = r.id
                WHERE r.prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id())
                  AND r.statut IN ('confirmee','en_cours','terminee'))));
DROP POLICY IF EXISTS animaux_insert ON purama_marketplace.animaux;
CREATE POLICY animaux_insert ON purama_marketplace.animaux FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS animaux_update ON purama_marketplace.animaux;
CREATE POLICY animaux_update ON purama_marketplace.animaux FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS animaux_delete ON purama_marketplace.animaux;
CREATE POLICY animaux_delete ON purama_marketplace.animaux FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND profil_id = purama_marketplace.mon_profil_id());

-- RLS policies : reservations
ALTER TABLE purama_marketplace.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservations_select ON purama_marketplace.reservations;
CREATE POLICY reservations_select ON purama_marketplace.reservations FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND (client_profil_id = purama_marketplace.mon_profil_id()
      OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id())));
DROP POLICY IF EXISTS reservations_insert ON purama_marketplace.reservations;
CREATE POLICY reservations_insert ON purama_marketplace.reservations FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND client_profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS reservations_update ON purama_marketplace.reservations;
CREATE POLICY reservations_update ON purama_marketplace.reservations FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id()
    AND (client_profil_id = purama_marketplace.mon_profil_id()
      OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id())))
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND (client_profil_id = purama_marketplace.mon_profil_id()
      OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id())));
DROP POLICY IF EXISTS reservations_delete ON purama_marketplace.reservations;
CREATE POLICY reservations_delete ON purama_marketplace.reservations FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND client_profil_id = purama_marketplace.mon_profil_id());

-- RLS policies : reservation_animaux
ALTER TABLE purama_marketplace.reservation_animaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservation_animaux_select ON purama_marketplace.reservation_animaux;
CREATE POLICY reservation_animaux_select ON purama_marketplace.reservation_animaux FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND (client_profil_id = purama_marketplace.mon_profil_id()
        OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()))));
DROP POLICY IF EXISTS reservation_animaux_insert ON purama_marketplace.reservation_animaux;
CREATE POLICY reservation_animaux_insert ON purama_marketplace.reservation_animaux FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND client_profil_id = purama_marketplace.mon_profil_id()));
DROP POLICY IF EXISTS reservation_animaux_update ON purama_marketplace.reservation_animaux;
CREATE POLICY reservation_animaux_update ON purama_marketplace.reservation_animaux FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND client_profil_id = purama_marketplace.mon_profil_id()))
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND client_profil_id = purama_marketplace.mon_profil_id()));
DROP POLICY IF EXISTS reservation_animaux_delete ON purama_marketplace.reservation_animaux;
CREATE POLICY reservation_animaux_delete ON purama_marketplace.reservation_animaux FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND client_profil_id = purama_marketplace.mon_profil_id()));

-- RLS policies : journal_garde
ALTER TABLE purama_marketplace.journal_garde ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_garde_select ON purama_marketplace.journal_garde;
CREATE POLICY journal_garde_select ON purama_marketplace.journal_garde FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND (client_profil_id = purama_marketplace.mon_profil_id()
        OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id()))));
DROP POLICY IF EXISTS journal_garde_insert ON purama_marketplace.journal_garde;
CREATE POLICY journal_garde_insert ON purama_marketplace.journal_garde FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND auteur_profil_id = purama_marketplace.mon_profil_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id())));
DROP POLICY IF EXISTS journal_garde_update ON purama_marketplace.journal_garde;
CREATE POLICY journal_garde_update ON purama_marketplace.journal_garde FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND auteur_profil_id = purama_marketplace.mon_profil_id())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND auteur_profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS journal_garde_delete ON purama_marketplace.journal_garde;
CREATE POLICY journal_garde_delete ON purama_marketplace.journal_garde FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND auteur_profil_id = purama_marketplace.mon_profil_id());

-- RLS policies : avis
ALTER TABLE purama_marketplace.avis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avis_select ON purama_marketplace.avis;
CREATE POLICY avis_select ON purama_marketplace.avis FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id()
    AND (auteur_profil_id = purama_marketplace.mon_profil_id()
      OR prestataire_id IN (SELECT id FROM purama_marketplace.prestataires WHERE profil_id = purama_marketplace.mon_profil_id())));
DROP POLICY IF EXISTS avis_insert ON purama_marketplace.avis;
CREATE POLICY avis_insert ON purama_marketplace.avis FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id()
    AND auteur_profil_id = purama_marketplace.mon_profil_id()
    AND reservation_id IN (SELECT id FROM purama_marketplace.reservations WHERE app_id = purama_marketplace.current_app_id()
      AND client_profil_id = purama_marketplace.mon_profil_id() AND statut = 'terminee'));
DROP POLICY IF EXISTS avis_update ON purama_marketplace.avis;
CREATE POLICY avis_update ON purama_marketplace.avis FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND auteur_profil_id = purama_marketplace.mon_profil_id())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND auteur_profil_id = purama_marketplace.mon_profil_id());
DROP POLICY IF EXISTS avis_delete ON purama_marketplace.avis;
CREATE POLICY avis_delete ON purama_marketplace.avis FOR DELETE TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND auteur_profil_id = purama_marketplace.mon_profil_id());

-- stripe_events, mouvements_argent : service_role uniquement (EX-073)
ALTER TABLE purama_marketplace.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE purama_marketplace.mouvements_argent ENABLE ROW LEVEL SECURITY;
