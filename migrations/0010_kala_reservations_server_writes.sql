-- KALA admission and money-bearing state changes must use the server handlers.
-- Keep the shared marketplace policies and other tenants' existing rights.
-- service_role has BYPASSRLS; user-facing SELECT policies are unchanged.
-- The signed settlement RPCs are already executable by service_role only (0009).

CREATE POLICY kala_reservations_insert_server
  ON purama_marketplace.reservations AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (app_id <> 'kala');

CREATE POLICY kala_reservations_update_server
  ON purama_marketplace.reservations AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (app_id <> 'kala')
  WITH CHECK (app_id <> 'kala');

CREATE POLICY kala_reservations_delete_server
  ON purama_marketplace.reservations AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (app_id <> 'kala');

-- A client-side profile delete would cascade to reservations and bypass their
-- DELETE policy. Account deletion already uses the scheduled admin flow.
CREATE POLICY kala_profils_delete_server
  ON purama_marketplace.profils AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (app_id <> 'kala');

-- Column-level UPDATE grants protect verification but do not protect INSERT.
-- The existing registration form creates an unverified draft; verification,
-- payment-account linkage and earned reputation remain server-owned.
CREATE POLICY kala_prestataires_insert_unverified
  ON purama_marketplace.prestataires AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    app_id <> 'kala' OR (
      statut_verification = 'brouillon'
      AND NOT badge_verifie
      AND identite_verifiee_le IS NULL
      AND entretien_video_le IS NULL
      AND NOT acaced_verifie
      AND acaced_verifie_le IS NULL
      AND stripe_account_id IS NULL
      AND NOT payouts_actifs
      AND karma_score = 0
      AND note_moyenne IS NULL
      AND nb_avis = 0
      AND nb_gardes_terminees = 0
      AND NOT est_demo
    )
  );
