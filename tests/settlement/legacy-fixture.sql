-- Inserted into the original 0001–0008 schema before applying the new migration.
SET search_path TO purama_marketplace, public;
INSERT INTO auth.users(id, email)
  VALUES ('00000000-0000-4000-8000-000000000001', 'historical-client@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'historical-teacher@example.invalid');
INSERT INTO profils(id, app_id, user_id, affichage_nom) VALUES
('00000000-0000-4000-8000-000000000011', 'kala', '00000000-0000-4000-8000-000000000001', 'Historique élève'),
('00000000-0000-4000-8000-000000000012', 'kala', '00000000-0000-4000-8000-000000000002', 'Historique prof');
INSERT INTO prestataires(id, app_id, profil_id, titre, presentation, commune, code_postal, latitude, longitude,
  stripe_account_id)
VALUES('00000000-0000-4000-8000-000000000020', 'kala', '00000000-0000-4000-8000-000000000012', 'Cours', 'Cours', 'Ville',
  '00000', 0, 0, 'acct_history');
INSERT INTO reservations(id, app_id, client_profil_id, prestataire_id, type_garde, debut_le, fin_le, tarif_cents,
  frais_service_cents, statut, stripe_payment_intent_id)
VALUES('00000000-0000-4000-8000-000000000030', 'kala', '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000020', 'visite', now()-interval '2 hours', now()-interval '1 hour', 10000, 900,
  'terminee', 'pi_history');
INSERT INTO mouvements_argent(app_id, reservation_id, categorie, montant_cents, reference_stripe)
  VALUES('kala', '00000000-0000-4000-8000-000000000030', 'charge_client', 10900, 'pi_history');
SELECT credit_wallet('kala', '00000000-0000-4000-8000-000000000011', 433, 'cashback_karma',
  '00000000-0000-4000-8000-000000000030', 'old A');
SELECT credit_wallet('kala', '00000000-0000-4000-8000-000000000011', 433, 'cashback_karma',
  '00000000-0000-4000-8000-000000000030', 'old B');
