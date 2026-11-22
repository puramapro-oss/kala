-- Synthetic fixtures only. Every row created by this contract is rolled back.
-- Run after all migrations; auth.uid() must read the synthetic JWT sub claim.
BEGIN;
SET LOCAL search_path TO purama_marketplace, public;
INSERT INTO auth.users(id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'kala-client@example.invalid'),
  ('a0000000-0000-4000-8000-000000000002', 'kala-teacher@example.invalid'),
  ('a0000000-0000-4000-8000-000000000003', 'kala-candidate@example.invalid');
INSERT INTO profils(id, app_id, user_id, affichage_nom) VALUES
  ('a0000000-0000-4000-8000-000000000011', 'kala', 'a0000000-0000-4000-8000-000000000001', 'Client'),
  ('a0000000-0000-4000-8000-000000000012', 'kala', 'a0000000-0000-4000-8000-000000000002', 'Teacher'),
  ('a0000000-0000-4000-8000-000000000013', 'pashu', 'a0000000-0000-4000-8000-000000000001', 'Other client'),
  ('a0000000-0000-4000-8000-000000000014', 'pashu', 'a0000000-0000-4000-8000-000000000002', 'Other teacher'),
  ('a0000000-0000-4000-8000-000000000015', 'kala', 'a0000000-0000-4000-8000-000000000003', 'Candidate');
INSERT INTO prestataires(id, app_id, profil_id, titre, presentation, commune, code_postal, latitude, longitude,
  statut_verification, video_30s_url, stripe_account_id) VALUES
  ('a0000000-0000-4000-8000-000000000021', 'kala', 'a0000000-0000-4000-8000-000000000012',
   'Cours', 'Cours', 'Ville', '00000', 0, 0, 'verifie', 'https://example.invalid/video.mp4', 'acct_kala_fixture'),
  ('a0000000-0000-4000-8000-000000000022', 'pashu', 'a0000000-0000-4000-8000-000000000014',
   'Autre', 'Autre', 'Ville', '00000', 0, 0, 'verifie', NULL, 'acct_other_fixture');
INSERT INTO reservations(id, app_id, client_profil_id, prestataire_id, type_garde, debut_le, fin_le,
  tarif_cents, frais_service_cents, statut) VALUES
  ('a0000000-0000-4000-8000-000000000031', 'kala', 'a0000000-0000-4000-8000-000000000011',
   'a0000000-0000-4000-8000-000000000021', 'domicile', now()-interval '2 hours', now()-interval '1 hour',
   2500, 225, 'en_attente_paiement'),
  ('a0000000-0000-4000-8000-000000000032', 'kala', 'a0000000-0000-4000-8000-000000000011',
   'a0000000-0000-4000-8000-000000000021', 'domicile', now()-interval '2 hours', now()-interval '1 hour',
   2500, 225, 'en_attente_paiement');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"app_id":"kala","sub":"a0000000-0000-4000-8000-000000000001"}';
DO $$
DECLARE affected integer;
BEGIN
  IF (SELECT count(*) FROM reservations) <> 2 THEN RAISE EXCEPTION 'Client cannot read their courses'; END IF;
  BEGIN
    INSERT INTO reservations(app_id, client_profil_id, prestataire_id, type_garde, debut_le, fin_le,
      tarif_cents, frais_service_cents, statut)
      VALUES('kala', 'a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000021',
      'domicile', now(), now()+interval '1 hour', 1, 0, 'confirmee');
    RAISE EXCEPTION 'Authenticated direct admission unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE reservations SET tarif_cents=1, frais_service_cents=0, statut='confirmee'
    WHERE id='a0000000-0000-4000-8000-000000000031';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Client could overwrite price or confirmation'; END IF;
  DELETE FROM reservations WHERE id='a0000000-0000-4000-8000-000000000031';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Client could erase a course outside the server flow'; END IF;
  DELETE FROM profils WHERE id='a0000000-0000-4000-8000-000000000011';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 OR (SELECT count(*) FROM reservations) <> 2 THEN
    RAISE EXCEPTION 'Profile deletion bypasses the reservation delete policy';
  END IF;
  IF has_function_privilege(current_user,
    'purama_marketplace.kala_recevoir_evenement(text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client has access to the privileged payment RPC';
  END IF;
END $$;
SELECT 'PASS: client read preserved; direct/cascaded writes and settlement RPC blocked' AS reservation_access;

SET LOCAL request.jwt.claims = '{"app_id":"kala","sub":"a0000000-0000-4000-8000-000000000002"}';
DO $$
DECLARE affected integer;
BEGIN
  IF (SELECT count(*) FROM reservations) <> 2 THEN RAISE EXCEPTION 'Teacher cannot read their courses'; END IF;
  UPDATE reservations SET statut='en_cours' WHERE id='a0000000-0000-4000-8000-000000000031';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Teacher could bypass the server state transition'; END IF;
END $$;
SELECT 'PASS: teacher read preserved; direct state transition blocked' AS reservation_access;

SET LOCAL request.jwt.claims = '{"app_id":"kala","sub":"a0000000-0000-4000-8000-000000000099"}';
DO $$ BEGIN
  IF EXISTS (SELECT FROM reservations) THEN RAISE EXCEPTION 'Unrelated user can read courses'; END IF;
END $$;
SELECT 'PASS: unrelated user cannot read reservations' AS reservation_access;

SET LOCAL request.jwt.claims = '{"app_id":"kala","sub":"a0000000-0000-4000-8000-000000000003"}';
DO $$
DECLARE attack jsonb; created uuid; affected integer;
BEGIN
  FOR attack IN SELECT value FROM jsonb_array_elements('[
    {"statut_verification":"verifie"},
    {"statut_verification":"en_attente"},
    {"identite_verifiee_le":"2026-01-01T00:00:00Z"},
    {"entretien_video_le":"2026-01-01T00:00:00Z"},
    {"acaced_verifie":true},
    {"acaced_verifie_le":"2026-01-01T00:00:00Z"},
    {"stripe_account_id":"acct_self_asserted"},
    {"karma_score":99}, {"note_moyenne":4.9}, {"nb_avis":999},
    {"nb_gardes_terminees":999}, {"est_demo":true}
  ]'::jsonb) LOOP
    BEGIN
      INSERT INTO prestataires(app_id, profil_id, titre, presentation, commune, code_postal, latitude, longitude,
        statut_verification, video_30s_url, identite_verifiee_le, entretien_video_le, acaced_verifie,
        acaced_verifie_le, stripe_account_id, karma_score, note_moyenne, nb_avis, nb_gardes_terminees, est_demo)
        VALUES('kala', 'a0000000-0000-4000-8000-000000000015', 'Cours', 'Cours', 'Ville', '00000', 0, 0,
          coalesce((attack->>'statut_verification')::statut_verification, 'brouillon'),
          'https://example.invalid/video.mp4', (attack->>'identite_verifiee_le')::timestamptz,
          (attack->>'entretien_video_le')::timestamptz, coalesce((attack->>'acaced_verifie')::boolean, false),
          (attack->>'acaced_verifie_le')::timestamptz, attack->>'stripe_account_id',
          coalesce((attack->>'karma_score')::integer, 0), (attack->>'note_moyenne')::numeric,
          coalesce((attack->>'nb_avis')::integer, 0), coalesce((attack->>'nb_gardes_terminees')::integer, 0),
          coalesce((attack->>'est_demo')::boolean, false));
      RAISE EXCEPTION 'Self-asserted teacher trust fields were accepted: %', attack;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  INSERT INTO prestataires(app_id, profil_id, titre, presentation, commune, code_postal, latitude, longitude,
    statut_verification, video_30s_url, acaced_numero, acaced_date_delivrance)
    VALUES('kala', 'a0000000-0000-4000-8000-000000000015', 'Cours', 'Cours', 'Ville', '00000', 0, 0,
      'brouillon', 'https://example.invalid/video.mp4', 'self-declared-document', '2026-01-01')
    RETURNING id INTO created;
  UPDATE prestataires SET titre='Titre édité' WHERE id=created;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Legitimate teacher draft editing was blocked'; END IF;
  BEGIN
    UPDATE prestataires SET statut_verification='verifie' WHERE id=created;
    RAISE EXCEPTION 'Teacher verification can still be self-granted by UPDATE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT 'PASS: teacher draft registration/editing preserved; self-granted verification, account and reputation blocked' AS reservation_access;

SET LOCAL request.jwt.claims = '{"app_id":"pashu","sub":"a0000000-0000-4000-8000-000000000001"}';
DO $$
DECLARE other_id uuid; affected integer;
BEGIN
  INSERT INTO reservations(app_id, client_profil_id, prestataire_id, type_garde, debut_le, fin_le,
    tarif_cents, frais_service_cents, statut)
    VALUES('pashu', 'a0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000022',
    'domicile', now(), now()+interval '1 hour', 2500, 225, 'brouillon') RETURNING id INTO other_id;
  UPDATE reservations SET tarif_cents=2600 WHERE id=other_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Other tenant update was changed'; END IF;
  DELETE FROM reservations WHERE id=other_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Other tenant delete was changed'; END IF;
  INSERT INTO prestataires(app_id, profil_id, titre, presentation, commune, code_postal, latitude, longitude,
    statut_verification)
    VALUES('pashu', 'a0000000-0000-4000-8000-000000000013', 'Autre', 'Autre', 'Ville', '00000', 0, 0, 'verifie')
    RETURNING id INTO other_id;
  DELETE FROM prestataires WHERE id=other_id;
  DELETE FROM profils WHERE id='a0000000-0000-4000-8000-000000000013';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Other tenant profile deletion was changed'; END IF;
END $$;
SELECT 'PASS: other tenant insert/update/delete preserved' AS reservation_access;

RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  result text;
  conflicting boolean := false;
  created uuid;
BEGIN
  UPDATE prestataires SET statut_verification='verifie', stripe_account_id='acct_candidate_fixture'
    WHERE profil_id='a0000000-0000-4000-8000-000000000015';
  IF NOT FOUND THEN RAISE EXCEPTION 'Service role cannot publish and link the teacher draft'; END IF;
  -- The same service role used by POST /api/reservations can still insert.
  INSERT INTO reservations(app_id, client_profil_id, prestataire_id, type_garde, debut_le, fin_le,
    tarif_cents, frais_service_cents, statut)
    VALUES('kala', 'a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000021',
    'domicile', now()+interval '1 hour', now()+interval '2 hours', 2500, 225, 'en_attente_paiement')
    RETURNING id INTO created;
  DELETE FROM reservations WHERE id=created;
  result := kala_recevoir_evenement('kala-admission-first', 'payment_intent.succeeded',
    '{"reservation_id":"a0000000-0000-4000-8000-000000000031","live":false,"amount":2725,"received":2725,
      "currency":"eur","intent":"pi_kala_first","app":"kala",
      "user":"a0000000-0000-4000-8000-000000000001","account":"acct_kala_fixture"}'::jsonb);
  IF result <> 'done' THEN RAISE EXCEPTION 'Legitimate server confirmation failed: %', result; END IF;
  BEGIN
    PERFORM kala_recevoir_evenement('kala-admission-second', 'payment_intent.succeeded',
      '{"reservation_id":"a0000000-0000-4000-8000-000000000032","live":false,"amount":2725,"received":2725,
        "currency":"eur","intent":"pi_kala_second","app":"kala",
        "user":"a0000000-0000-4000-8000-000000000001","account":"acct_kala_fixture"}'::jsonb);
  EXCEPTION WHEN exclusion_violation THEN conflicting := true;
  END;
  IF NOT conflicting THEN RAISE EXCEPTION 'Two overlapping courses were confirmed'; END IF;
  IF (SELECT count(*) FROM reservations WHERE id IN ('a0000000-0000-4000-8000-000000000031',
    'a0000000-0000-4000-8000-000000000032') AND statut='confirmee') <> 1 THEN
    RAISE EXCEPTION 'Unexpected confirmed course count';
  END IF;
  IF EXISTS (SELECT FROM mouvements_argent WHERE reference_stripe='pi_kala_second') THEN
    RAISE EXCEPTION 'The failed confirmation left a charge ledger entry';
  END IF;
  IF EXISTS (SELECT FROM stripe_events WHERE event_id='kala-admission-second') THEN
    RAISE EXCEPTION 'The failed confirmation left a partially committed event';
  END IF;
END $$;
SELECT 'PASS: server admission and signed confirmation preserved; overlap rolls back atomically' AS reservation_access;

DO $$
DECLARE result text; affected integer;
BEGIN
  UPDATE reservations SET statut='en_cours' WHERE id='a0000000-0000-4000-8000-000000000031';
  result := kala_recevoir_evenement('kala-admission-completion', 'reservation.terminee',
    '{"reservation_id":"a0000000-0000-4000-8000-000000000031","live":false}'::jsonb);
  IF result <> 'settle' THEN RAISE EXCEPTION 'Legitimate server completion failed: %', result; END IF;
  UPDATE reservations SET statut='annulee_client' WHERE id='a0000000-0000-4000-8000-000000000032';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Server cannot cancel an unpaid pending course'; END IF;
END $$;
SELECT 'PASS: server start/completion and unpaid cancellation preserved' AS reservation_access;

DO $$
DECLARE affected integer;
BEGIN
  DELETE FROM profils WHERE id='a0000000-0000-4000-8000-000000000011';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 OR EXISTS(SELECT FROM reservations WHERE client_profil_id='a0000000-0000-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'The authorised server profile deletion/cascade was blocked';
  END IF;
END $$;
SELECT 'PASS: authorised server profile deletion still cascades' AS reservation_access;
RESET ROLE;
ROLLBACK;
