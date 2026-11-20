-- Receipts for the KALA course payment flow. Previously recorded rows are never rewritten.
BEGIN;

CREATE TABLE purama_marketplace.kala_reglements_activation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_le timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO purama_marketplace.kala_reglements_activation DEFAULT VALUES;

-- Keep the receipts even when a reservation or profile is subsequently removed.
CREATE TABLE purama_marketplace.kala_reglements (
  reservation_id uuid PRIMARY KEY,
  client_profil_id uuid NOT NULL,
  prestataire_id uuid NOT NULL,
  profil_prof_id uuid NOT NULL,
  compte_stripe text NOT NULL,
  intent_id text NOT NULL,
  mode_live boolean NOT NULL,
  tarif_cents integer NOT NULL CHECK (tarif_cents > 0),
  frais_cents integer NOT NULL CHECK (frais_cents >= 0),
  phase text NOT NULL CHECK (phase IN ('transfer_ready', 'transfer_inflight', 'payout_ready', 'payout_inflight',
    'cashback_ready', 'email_ready', 'email_inflight', 'done', 'review')),
  methode text NOT NULL DEFAULT 'instant' CHECK (methode IN ('instant', 'standard')),
  titulaire uuid,
  tentative_le timestamptz,
  transfert_id text UNIQUE,
  versement_id text UNIQUE,
  cashback_cents integer CHECK (cashback_cents >= 0),
  email_id text UNIQUE,
  observation text,
  CHECK ((phase IN ('transfer_inflight', 'payout_inflight', 'email_inflight')) = (titulaire IS NOT NULL)),
  CHECK ((titulaire IS NULL) = (tentative_le IS NULL))
);

ALTER TABLE purama_marketplace.kala_reglements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purama_marketplace.kala_reglements_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON purama_marketplace.kala_reglements, purama_marketplace.kala_reglements_activation
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON purama_marketplace.kala_reglements, purama_marketplace.kala_reglements_activation TO service_role;

CREATE INDEX kala_payment_event_reservation ON purama_marketplace.stripe_events
  ((payload -> 'details' ->> 'reservation_id'), (payload -> 'details' ->> 'intent'))
  WHERE app_id = 'kala' AND type = 'payment_intent.succeeded' AND traite_le IS NOT NULL;
CREATE INDEX kala_money_reservation ON purama_marketplace.mouvements_argent (reservation_id, categorie)
  WHERE app_id = 'kala' AND reservation_id IS NOT NULL;
CREATE INDEX kala_wallet_cashback_reservation ON purama_marketplace.wallet_mouvements (reservation_id)
  WHERE app_id = 'kala' AND categorie = 'cashback_karma';

-- 0004 grants writers through shared SECURITY DEFINER functions. Keep those public signatures
-- and other tenants' grants intact. In PostgREST the selected SQL role remains in the `role`
-- setting during a SECURITY DEFINER call; a direct database connection uses its session role.
-- The trigger's own EXECUTE ACL is the sole allowlist for KALA wallet writes.
CREATE FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  caller name := coalesce(nullif(nullif(current_setting('role', true), 'none'), ''), session_user);
BEGIN
  IF NOT has_function_privilege(caller, 'purama_marketplace.kala_garder_ecriture_portefeuille()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'KALA wallet writes require the service role' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille() TO service_role;

CREATE TRIGGER kala_wallet_insert_writer BEFORE INSERT ON purama_marketplace.wallets
FOR EACH ROW WHEN (NEW.app_id = 'kala') EXECUTE FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille();
CREATE TRIGGER kala_wallet_update_writer BEFORE UPDATE ON purama_marketplace.wallets
FOR EACH ROW WHEN (OLD.app_id = 'kala' OR NEW.app_id = 'kala') EXECUTE FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille();
CREATE TRIGGER kala_wallet_movement_insert_writer BEFORE INSERT ON purama_marketplace.wallet_mouvements
FOR EACH ROW WHEN (NEW.app_id = 'kala') EXECUTE FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille();
CREATE TRIGGER kala_wallet_movement_update_writer BEFORE UPDATE ON purama_marketplace.wallet_mouvements
FOR EACH ROW WHEN (OLD.app_id = 'kala' OR NEW.app_id = 'kala') EXECUTE FUNCTION purama_marketplace.kala_garder_ecriture_portefeuille();

-- The existing wallet function credits the balance before writing its movement, in the same
-- transaction. A rejected duplicate therefore rolls back the balance as well. The guard applies
-- only to KALA cashback, including calls from older code. Existing duplicate rows stay intact.
CREATE TABLE purama_marketplace.kala_cashback_reservations (reservation_id uuid PRIMARY KEY);
ALTER TABLE purama_marketplace.kala_cashback_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON purama_marketplace.kala_cashback_reservations FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION purama_marketplace.kala_garder_cashback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.reservation_id IS NULL OR NEW.montant_cents <= 0 OR NOT EXISTS (
    SELECT 1 FROM purama_marketplace.reservations r JOIN purama_marketplace.wallets w ON w.id = NEW.wallet_id
    WHERE r.id = NEW.reservation_id AND r.app_id = 'kala' AND r.client_profil_id = NEW.profil_id
      AND w.app_id = 'kala' AND w.profil_id = NEW.profil_id
  ) THEN RAISE EXCEPTION 'invalid KALA cashback binding';
  END IF;
  INSERT INTO purama_marketplace.kala_cashback_reservations VALUES (NEW.reservation_id);
  IF EXISTS (SELECT FROM purama_marketplace.wallet_mouvements WHERE app_id = 'kala' AND reservation_id = NEW.reservation_id
    AND categorie = 'cashback_karma') THEN
    RAISE EXCEPTION 'KALA cashback already recorded';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION purama_marketplace.kala_garder_cashback() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kala_cashback_unique BEFORE INSERT ON purama_marketplace.wallet_mouvements
FOR EACH ROW WHEN (NEW.app_id = 'kala' AND NEW.categorie = 'cashback_karma')
EXECUTE FUNCTION purama_marketplace.kala_garder_cashback();

CREATE OR REPLACE FUNCTION purama_marketplace.kala_recevoir_evenement(p_id text, p_type text, p_details jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event_row purama_marketplace.stripe_events;
  booking purama_marketplace.reservations;
  teacher purama_marketplace.prestataires;
  settlement purama_marketplace.kala_reglements;
  money_movement purama_marketplace.mouvements_argent;
  source constant text := 'kala-reglements-v1';
  customer_user uuid;
  movement_count integer;
  first_charge boolean;
  issue text;
BEGIN
  IF nullif(p_id, '') IS NULL OR nullif(p_type, '') IS NULL OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid event';
  END IF;
  INSERT INTO purama_marketplace.stripe_events(event_id, app_id, type, payload)
    VALUES(p_id, 'kala', p_type, jsonb_build_object('source', source, 'details', p_details))
      ON CONFLICT (event_id) DO NOTHING;
  SELECT * INTO STRICT event_row FROM purama_marketplace.stripe_events WHERE event_id = p_id FOR UPDATE;
  IF event_row.app_id <> 'kala' OR event_row.type <> p_type THEN
    RETURN 'event_conflict';
  END IF;
  IF event_row.payload ->> 'source' IS DISTINCT FROM source THEN
    IF event_row.traite_le IS NOT NULL THEN
      RETURN 'processed';
    END IF;
    UPDATE purama_marketplace.stripe_events SET erreur = coalesce(erreur, 'legacy_event_review') WHERE event_id = p_id;
    RETURN 'legacy_event_review';
  END IF;
  IF event_row.payload -> 'details' IS DISTINCT FROM p_details THEN
    RETURN 'event_conflict';
  END IF;
  IF event_row.traite_le IS NOT NULL THEN
    RETURN 'processed';
  END IF;
  IF p_type = 'reservation.terminee' AND EXISTS (SELECT FROM purama_marketplace.kala_reglements
    WHERE reservation_id = (p_details ->> 'reservation_id')::uuid AND phase = 'done') THEN
    UPDATE purama_marketplace.stripe_events SET traite_le = clock_timestamp(), erreur = NULL WHERE event_id = p_id;
    RETURN 'done';
  END IF;
  IF p_type IN ('payment_intent.succeeded', 'reservation.terminee') THEN
    SELECT * INTO booking FROM purama_marketplace.reservations WHERE app_id = 'kala'
      AND id = (p_details ->> 'reservation_id')::uuid FOR UPDATE;
    IF NOT FOUND OR booking.est_demo THEN
      issue := 'reservation_unavailable';
    END IF;
    SELECT * INTO teacher FROM purama_marketplace.prestataires WHERE app_id = 'kala' AND id = booking.prestataire_id;
    SELECT user_id INTO customer_user FROM purama_marketplace.profils WHERE app_id = 'kala' AND id = booking.client_profil_id
      AND NOT est_demo;
    IF issue IS NULL AND (customer_user IS NULL OR teacher.profil_id IS NULL OR nullif(teacher.stripe_account_id, '') IS NULL
      OR teacher.est_demo OR NOT EXISTS (
      SELECT FROM purama_marketplace.profils WHERE app_id = 'kala' AND id = teacher.profil_id AND NOT est_demo
    )) THEN
      issue := 'actor_mismatch';
    END IF;
  END IF;
  IF issue IS NULL AND jsonb_typeof(p_details -> 'live') IS DISTINCT FROM 'boolean' THEN
    issue := 'payment_mode_review';
  END IF;
  IF issue IS NULL AND p_type = 'payment_intent.succeeded' THEN
    IF (p_details ->> 'amount')::integer IS DISTINCT FROM booking.total_client_cents
      OR (p_details ->> 'received')::integer IS DISTINCT FROM booking.total_client_cents
      OR p_details ->> 'currency' IS DISTINCT FROM 'eur' OR nullif(p_details ->> 'intent', '') IS NULL
      OR (booking.stripe_payment_intent_id IS NOT NULL AND booking.stripe_payment_intent_id <> p_details ->> 'intent')
      OR EXISTS (SELECT FROM purama_marketplace.reservations other
        WHERE other.stripe_payment_intent_id = p_details ->> 'intent' AND other.id<>booking.id)
      OR (p_details ->> 'user' IS NOT NULL AND p_details ->> 'user' <> customer_user::text)
      OR (p_details ->> 'account' IS NOT NULL AND p_details ->> 'account' <> teacher.stripe_account_id)
      OR (booking.stripe_payment_intent_id IS NULL AND (p_details ->> 'app' IS DISTINCT FROM 'kala'
        OR p_details ->> 'user' IS DISTINCT FROM customer_user::text OR p_details ->> 'account' IS DISTINCT
        FROM teacher.stripe_account_id))
    THEN issue := 'payment_mismatch';
    ELSIF booking.statut NOT IN ('en_attente_paiement', 'confirmee', 'en_cours', 'terminee') THEN
      issue := 'payment_state_review';
    ELSE
      SELECT count(*) INTO movement_count FROM purama_marketplace.mouvements_argent WHERE app_id = 'kala'
        AND reservation_id = booking.id AND categorie = 'charge_client';
      SELECT * INTO money_movement FROM purama_marketplace.mouvements_argent WHERE app_id = 'kala'
        AND reservation_id = booking.id AND categorie = 'charge_client' LIMIT 1;
      IF movement_count > 1 OR (movement_count = 1 AND (money_movement.reference_stripe IS DISTINCT
        FROM p_details ->> 'intent' OR money_movement.montant_cents <> booking.total_client_cents
        OR money_movement.devise <> 'eur')) THEN
        issue := 'charge_history_review';
      ELSE
        first_charge := movement_count = 0 AND booking.statut = 'en_attente_paiement'
          AND booking.stripe_payment_intent_id IS NULL;
        IF movement_count = 0 THEN
          INSERT INTO purama_marketplace.mouvements_argent(app_id, reservation_id, categorie, montant_cents,
            reference_stripe)
          VALUES('kala', booking.id, 'charge_client', booking.total_client_cents, p_details ->> 'intent');
          END IF;
        UPDATE purama_marketplace.reservations SET stripe_payment_intent_id = p_details ->> 'intent',
          statut = CASE WHEN statut = 'en_attente_paiement'
            THEN 'confirmee'::purama_marketplace.statut_reservation ELSE statut END
          WHERE app_id = 'kala' AND id = booking.id;
        UPDATE purama_marketplace.stripe_events SET payload = payload||jsonb_build_object('first_charge', first_charge)
          WHERE event_id = p_id;
      END IF;
    END IF;
  ELSIF issue IS NULL AND p_type = 'reservation.terminee' THEN
    SELECT * INTO settlement FROM purama_marketplace.kala_reglements WHERE reservation_id = booking.id;
    IF FOUND THEN
      IF settlement.phase = 'done' THEN
        NULL;
      ELSIF settlement.mode_live IS DISTINCT FROM (p_details ->> 'live')::boolean THEN
        issue := 'settlement_mode_mismatch';
      ELSIF settlement.phase = 'review' THEN
        issue := settlement.observation;
      ELSE
        RETURN 'settle';
      END IF;
    ELSIF booking.statut NOT IN ('en_cours', 'terminee') OR booking.fin_le > clock_timestamp() THEN
      issue := 'course_not_finished';
    ELSIF booking.stripe_payment_intent_id IS NULL OR (SELECT count(*) FROM purama_marketplace.mouvements_argent
      WHERE app_id = 'kala' AND reservation_id = booking.id AND categorie = 'charge_client')<>1 OR NOT EXISTS (
      SELECT FROM purama_marketplace.mouvements_argent WHERE app_id = 'kala' AND reservation_id = booking.id
        AND categorie = 'charge_client'
        AND reference_stripe = booking.stripe_payment_intent_id AND montant_cents = booking.total_client_cents
          AND devise = 'eur'
    ) THEN
      issue := 'payment_evidence_missing';
    ELSE
      IF booking.stripe_transfer_id IS NOT NULL OR booking.transfert_demande_le IS NOT NULL
        OR booking.transfert_confirme_le IS NOT NULL
        OR EXISTS (SELECT FROM purama_marketplace.mouvements_argent WHERE app_id = 'kala' AND reservation_id = booking.id
          AND categorie IN ('transfert_gardien', 'remboursement'))
        OR EXISTS (SELECT FROM purama_marketplace.wallet_mouvements WHERE app_id = 'kala' AND reservation_id = booking.id
          AND categorie = 'cashback_karma')
        OR (booking.cree_le < (SELECT active_le FROM purama_marketplace.kala_reglements_activation) AND NOT EXISTS (
          SELECT FROM purama_marketplace.stripe_events WHERE app_id = 'kala' AND type = 'payment_intent.succeeded'
            AND traite_le IS NOT NULL
            AND payload ->> 'source' = source AND payload ->> 'first_charge' = 'true'
              AND payload -> 'details' ->> 'reservation_id' = booking.id::text
            AND payload -> 'details' ->> 'intent' = booking.stripe_payment_intent_id
        )) THEN
        issue := 'legacy_settlement_review';
      ELSIF NOT EXISTS (SELECT FROM purama_marketplace.stripe_events WHERE app_id = 'kala'
        AND type = 'payment_intent.succeeded' AND traite_le IS NOT NULL
          AND payload ->> 'source' = source AND payload -> 'details' ->> 'reservation_id' = booking.id::text
            AND payload -> 'details' ->> 'intent' = booking.stripe_payment_intent_id
          AND payload -> 'details' -> 'live' = p_details -> 'live') THEN
        UPDATE purama_marketplace.stripe_events SET erreur = 'payment_mode_review' WHERE event_id = p_id;
        RETURN 'payment_mode_review';
      END IF;
      INSERT INTO purama_marketplace.kala_reglements(reservation_id, client_profil_id, prestataire_id, profil_prof_id,
        compte_stripe, intent_id, mode_live, tarif_cents, frais_cents, phase, observation)
        VALUES(booking.id, booking.client_profil_id, teacher.id, teacher.profil_id, teacher.stripe_account_id,
          booking.stripe_payment_intent_id, (p_details ->> 'live')::boolean, booking.tarif_cents,
          booking.frais_service_cents,
          CASE WHEN issue IS NULL THEN 'transfer_ready' ELSE 'review' END, issue);
      IF issue IS NULL THEN
        UPDATE purama_marketplace.reservations SET statut = 'terminee' WHERE app_id = 'kala' AND id = booking.id;
        RETURN 'settle';
      END IF;
    END IF;
  END IF;
  IF issue IS NOT NULL THEN
    UPDATE purama_marketplace.stripe_events SET erreur = issue WHERE event_id = p_id;
    RETURN issue;
  END IF;
  UPDATE purama_marketplace.stripe_events SET traite_le = clock_timestamp(), erreur = NULL WHERE event_id = p_id;
  RETURN 'done';
END; $$;

CREATE OR REPLACE FUNCTION purama_marketplace.kala_avancer_reglement(p_reservation uuid, p_action text, p_titulaire uuid,
  p_reference text DEFAULT NULL, p_cents integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  settlement purama_marketplace.kala_reglements;
  booking purama_marketplace.reservations;
  movement purama_marketplace.wallet_mouvements;
  actor_email text;
  actor_name text;
  next_phase text;
  effect text;
  movement_count integer;
BEGIN
  IF p_titulaire IS NULL THEN
    RAISE EXCEPTION 'missing operation owner';
  END IF;
  -- Same lock order as event admission. It also serializes a charge, receipt or new delivery.
  SELECT * INTO booking FROM purama_marketplace.reservations WHERE app_id = 'kala' AND id = p_reservation FOR UPDATE;
  SELECT * INTO STRICT settlement FROM purama_marketplace.kala_reglements WHERE reservation_id = p_reservation FOR UPDATE;
  IF settlement.phase = 'done' THEN
    RETURN jsonb_build_object('action', 'done');
  END IF;
  IF settlement.phase = 'review' THEN
    RETURN jsonb_build_object('action', 'review', 'reason', settlement.observation);
  END IF;
  IF p_action IN ('next', 'cashback') AND settlement.titulaire IS NULL THEN
    -- No new provider request may consume data changed since admission.
    IF booking.id IS NULL OR booking.est_demo OR booking.statut<>'terminee' OR booking.stripe_payment_intent_id IS DISTINCT
      FROM settlement.intent_id
      OR booking.client_profil_id<>settlement.client_profil_id OR booking.prestataire_id<>settlement.prestataire_id
        OR booking.tarif_cents<>settlement.tarif_cents OR booking.frais_service_cents<>settlement.frais_cents
      OR booking.stripe_transfer_id IS DISTINCT FROM settlement.transfert_id OR booking.remboursement_cents > 0
      OR EXISTS (SELECT FROM purama_marketplace.mouvements_argent WHERE app_id = 'kala' AND reservation_id = booking.id
        AND categorie = 'remboursement')
      OR NOT EXISTS (SELECT FROM purama_marketplace.prestataires teacher JOIN purama_marketplace.profils teacher_profile
        ON teacher_profile.id = teacher.profil_id AND teacher_profile.app_id = 'kala'
        WHERE teacher.app_id = 'kala' AND teacher.id = settlement.prestataire_id
          AND teacher.profil_id = settlement.profil_prof_id AND NOT teacher.est_demo AND NOT teacher_profile.est_demo
          AND teacher.stripe_account_id = settlement.compte_stripe)
    THEN UPDATE purama_marketplace.kala_reglements SET phase = 'review', observation = 'settlement_snapshot_changed'
      WHERE reservation_id = p_reservation;
      RETURN jsonb_build_object('action', 'review', 'reason', 'settlement_snapshot_changed');
    END IF;
  END IF;
  IF p_action = 'next' THEN
    IF settlement.titulaire IS NOT NULL THEN
      IF settlement.observation IS NOT NULL OR settlement.tentative_le < clock_timestamp()-interval '5 minutes' THEN
        UPDATE purama_marketplace.kala_reglements
          SET observation = coalesce(observation, settlement.phase||'_receipt_missing') WHERE reservation_id = p_reservation;
        RETURN jsonb_build_object('action', 'review', 'reason', coalesce(settlement.observation,
          settlement.phase||'_receipt_missing'));
      END IF;
      RETURN jsonb_build_object('action', 'busy');
    END IF;
    IF settlement.phase = 'cashback_ready' THEN
      RETURN jsonb_build_object('action', 'cashback', 'fees', settlement.frais_cents);
    END IF;
    IF settlement.phase = 'email_ready' THEN
      SELECT teacher_user.email, teacher_profile.affichage_nom INTO actor_email, actor_name
        FROM purama_marketplace.profils teacher_profile JOIN auth.users teacher_user
        ON teacher_user.id = teacher_profile.user_id
        WHERE teacher_profile.app_id = 'kala' AND teacher_profile.id = settlement.profil_prof_id;
      IF nullif(actor_email, '') IS NULL THEN
        UPDATE purama_marketplace.kala_reglements SET phase = 'done', observation = 'email_address_absent'
          WHERE reservation_id = p_reservation;
        RETURN jsonb_build_object('action', 'done');
      END IF;
    END IF;
    effect := CASE settlement.phase WHEN 'transfer_ready' THEN 'transfer' WHEN 'payout_ready'
      THEN 'payout' WHEN 'email_ready' THEN 'email' END;
    IF effect IS NULL THEN
      RAISE EXCEPTION 'invalid settlement phase';
    END IF;
    UPDATE purama_marketplace.kala_reglements
      SET phase = effect||'_inflight', titulaire = p_titulaire, tentative_le = clock_timestamp(), observation = NULL
      WHERE reservation_id = p_reservation;
    RETURN jsonb_strip_nulls(jsonb_build_object('action', effect, 'amount', settlement.tarif_cents, 'account',
      settlement.compte_stripe, 'method', settlement.methode, 'email', actor_email, 'name', actor_name));
  END IF;
  IF p_action = 'cashback' THEN
    IF settlement.phase<>'cashback_ready' THEN
      RETURN jsonb_build_object('action', 'continue');
    END IF;
    IF p_cents IS NULL OR p_cents<0 OR p_cents>settlement.frais_cents THEN
      RAISE EXCEPTION 'invalid cashback';
    END IF;
    SELECT count(*) INTO movement_count FROM purama_marketplace.wallet_mouvements WHERE app_id = 'kala'
      AND reservation_id = p_reservation AND categorie = 'cashback_karma';
    SELECT * INTO movement FROM purama_marketplace.wallet_mouvements WHERE app_id = 'kala' AND reservation_id = p_reservation
      AND categorie = 'cashback_karma' LIMIT 1;
    IF movement_count>1 OR (movement_count = 1 AND (movement.profil_id<>settlement.client_profil_id
      OR movement.montant_cents<>p_cents OR NOT EXISTS
       (SELECT FROM purama_marketplace.wallets WHERE id = movement.wallet_id AND app_id = 'kala'
         AND profil_id = settlement.client_profil_id))) THEN
      UPDATE purama_marketplace.kala_reglements SET phase = 'review', observation = 'cashback_history_mismatch'
        WHERE reservation_id = p_reservation;
      RETURN jsonb_build_object('action', 'review', 'reason', 'cashback_history_mismatch');
    END IF;
    IF movement_count = 0 AND p_cents>0 THEN
      PERFORM purama_marketplace.credit_wallet('kala', settlement.client_profil_id, p_cents, 'cashback_karma', p_reservation,
        'Cashback KARMA cours #'||left(p_reservation::text, 8));
    END IF;
    UPDATE purama_marketplace.kala_reglements SET cashback_cents = p_cents, phase = 'email_ready'
      WHERE reservation_id = p_reservation;
    RETURN jsonb_build_object('action', 'continue');
  END IF;
  IF settlement.titulaire IS DISTINCT FROM p_titulaire THEN
    RETURN jsonb_build_object('action', 'busy');
  END IF;
  IF p_action = 'uncertain' THEN
    UPDATE purama_marketplace.kala_reglements SET observation = settlement.phase||'_receipt_missing'
      WHERE reservation_id = p_reservation;
    RETURN jsonb_build_object('action', 'review', 'reason', settlement.phase||'_receipt_missing');
  END IF;
  IF p_action = 'standard_allowed' AND settlement.phase = 'payout_inflight' AND settlement.methode = 'instant' THEN
    -- Stripe positively refused instant. A fresh claim is required before the standard request.
    UPDATE purama_marketplace.kala_reglements
      SET phase = 'payout_ready', methode = 'standard', titulaire = NULL, tentative_le = NULL, observation = NULL
      WHERE reservation_id = p_reservation;
    RETURN jsonb_build_object('action', 'continue');
  END IF;
  IF nullif(p_reference, '') IS NULL THEN
    RAISE EXCEPTION 'missing provider receipt';
  END IF;
  IF p_action = 'transfer_receipt' AND settlement.phase = 'transfer_inflight' THEN
    IF booking.id IS NULL OR (booking.stripe_transfer_id IS NOT NULL AND booking.stripe_transfer_id<>p_reference) OR EXISTS (
      SELECT FROM purama_marketplace.mouvements_argent WHERE app_id = 'kala' AND reservation_id = p_reservation
        AND categorie = 'transfert_gardien'
    ) THEN
      UPDATE purama_marketplace.kala_reglements SET observation = 'transfer_history_mismatch', transfert_id = p_reference
        WHERE reservation_id = p_reservation;
      RETURN jsonb_build_object('action', 'review', 'reason', 'transfer_history_mismatch');
    END IF;
    INSERT INTO purama_marketplace.mouvements_argent(app_id, reservation_id, categorie, montant_cents, reference_stripe)
      VALUES('kala', p_reservation, 'transfert_gardien', settlement.tarif_cents, p_reference);
    UPDATE purama_marketplace.reservations
      SET stripe_transfer_id = p_reference, transfert_demande_le = coalesce(transfert_demande_le, settlement.tentative_le),
      transfert_confirme_le = clock_timestamp()
      WHERE app_id = 'kala' AND id = p_reservation;
    UPDATE purama_marketplace.kala_reglements SET transfert_id = p_reference WHERE reservation_id = p_reservation;
    next_phase := 'payout_ready';
  ELSIF p_action = 'payout_receipt' AND settlement.phase = 'payout_inflight' THEN
    UPDATE purama_marketplace.kala_reglements SET versement_id = p_reference WHERE reservation_id = p_reservation;
    next_phase := 'cashback_ready';
  ELSIF p_action = 'email_receipt' AND settlement.phase = 'email_inflight' THEN
    UPDATE purama_marketplace.kala_reglements SET email_id = p_reference WHERE reservation_id = p_reservation;
    next_phase := 'done';
  ELSE RAISE EXCEPTION 'unexpected receipt';
  END IF;
  UPDATE purama_marketplace.kala_reglements SET phase = next_phase, titulaire = NULL, tentative_le = NULL, observation = NULL
    WHERE reservation_id = p_reservation;
  RETURN jsonb_build_object('action', 'continue');
END; $$;

REVOKE ALL ON FUNCTION purama_marketplace.kala_recevoir_evenement(text, text, jsonb),
  purama_marketplace.kala_avancer_reglement(uuid, text, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purama_marketplace.kala_recevoir_evenement(text, text, jsonb),
  purama_marketplace.kala_avancer_reglement(uuid, text, uuid, text, integer) TO service_role;
COMMIT;
