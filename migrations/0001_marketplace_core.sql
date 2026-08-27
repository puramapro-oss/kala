-- 0001_marketplace_core.sql — PASHU marketplace DB moule d'or
-- Appliquée par: docker exec -i supabase-db psql -U supabase_admin -d postgres
-- JAMAIS psql -h localhost -p 5432 (pooler Supavisor — PIEGES §2)

CREATE SCHEMA IF NOT EXISTS purama_marketplace;
SET search_path TO purama_marketplace, public;

CREATE TABLE IF NOT EXISTS purama_marketplace.apps (
  app_id  text PRIMARY KEY,
  nom     text NOT NULL,
  actif   boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);
INSERT INTO purama_marketplace.apps (app_id, nom)
VALUES ('pashu', 'PASHU') ON CONFLICT (app_id) DO NOTHING;

-- Contexte applicatif — FERMÉ PAR DÉFAUT (EX-077).
CREATE OR REPLACE FUNCTION purama_marketplace.current_app_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = purama_marketplace, public AS $$
  SELECT COALESCE(
    NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'app_id', ''),
    NULLIF(NULLIF(current_setting('request.headers',   true), '')::json ->> 'x-purama-app', '')
  );
$$;

CREATE TYPE purama_marketplace.statut_verification AS ENUM
  ('brouillon','en_attente','verifie','refuse','suspendu');
CREATE TYPE purama_marketplace.type_garde AS ENUM ('domicile','visite','promenade');
CREATE TYPE purama_marketplace.recurrence AS ENUM ('aucune','hebdomadaire'); -- V1 : toujours 'aucune'
CREATE TYPE purama_marketplace.statut_reservation AS ENUM
  ('brouillon','en_attente_paiement','confirmee','en_cours','terminee',
   'annulee_client','annulee_gardien','litige');
CREATE TYPE purama_marketplace.espece AS ENUM ('chien','chat','autre');
CREATE TYPE purama_marketplace.type_entree_journal AS ENUM
  ('photo','repas','promenade','note','medicament','incident');
CREATE TYPE purama_marketplace.categorie_mouvement AS ENUM
  ('charge_client','frais_service','transfert_gardien','remboursement',
   'karma_users','karma_asso','karma_sasu');

CREATE TABLE purama_marketplace.profils (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affichage_nom text NOT NULL,
  avatar_url    text,
  commune       text,
  telephone     text,
  est_demo      boolean NOT NULL DEFAULT false,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  maj_le        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, user_id)
);

CREATE TABLE purama_marketplace.prestataires (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id               text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  profil_id            uuid NOT NULL REFERENCES purama_marketplace.profils(id) ON DELETE CASCADE,
  titre                text NOT NULL,
  presentation         text NOT NULL,
  commune              text NOT NULL,
  code_postal          text NOT NULL,
  latitude             double precision NOT NULL,
  longitude            double precision NOT NULL,
  rayon_km             integer NOT NULL DEFAULT 15 CHECK (rayon_km BETWEEN 1 AND 50),
  adresse_exacte       text,
  statut_verification  purama_marketplace.statut_verification NOT NULL DEFAULT 'brouillon',
  badge_verifie        boolean NOT NULL DEFAULT false,
  identite_verifiee_le timestamptz,
  entretien_video_le   timestamptz,
  karma_score          integer NOT NULL DEFAULT 0 CHECK (karma_score BETWEEN 0 AND 100),
  note_moyenne         numeric(2,1),
  nb_avis              integer NOT NULL DEFAULT 0,
  nb_gardes_terminees  integer NOT NULL DEFAULT 0,
  stripe_account_id    text,
  payouts_actifs       boolean NOT NULL DEFAULT false,
  est_demo             boolean NOT NULL DEFAULT false,
  cree_le              timestamptz NOT NULL DEFAULT now(),
  maj_le               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, profil_id),
  CONSTRAINT badge_coherent CHECK (
    badge_verifie = false
    OR (statut_verification = 'verifie'
        AND identite_verifiee_le IS NOT NULL
        AND entretien_video_le  IS NOT NULL)
  )
);
CREATE INDEX prestataires_recherche_idx
  ON purama_marketplace.prestataires (app_id, statut_verification, latitude, longitude);

CREATE TABLE purama_marketplace.prestations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id         text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  prestataire_id uuid NOT NULL REFERENCES purama_marketplace.prestataires(id) ON DELETE CASCADE,
  type_garde     purama_marketplace.type_garde NOT NULL,
  prix_cents     integer NOT NULL CHECK (prix_cents > 0),
  actif          boolean NOT NULL DEFAULT true,
  est_demo       boolean NOT NULL DEFAULT false,
  cree_le        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, prestataire_id, type_garde)
);

CREATE TABLE purama_marketplace.animaux (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id            text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  profil_id         uuid NOT NULL REFERENCES purama_marketplace.profils(id) ON DELETE CASCADE,
  nom               text NOT NULL,
  espece            purama_marketplace.espece NOT NULL,
  race              text,
  date_naissance    date,
  photo_path        text,
  caractere         text,
  habitudes         text,
  allergies         text,
  traitements       text,
  veto_referent_nom text,
  veto_referent_tel text,
  est_demo          boolean NOT NULL DEFAULT false,
  cree_le           timestamptz NOT NULL DEFAULT now(),
  maj_le            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX animaux_proprietaire_idx ON purama_marketplace.animaux (app_id, profil_id);

CREATE TABLE purama_marketplace.reservations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id                   text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  client_profil_id         uuid NOT NULL REFERENCES purama_marketplace.profils(id) ON DELETE CASCADE,
  prestataire_id           uuid NOT NULL REFERENCES purama_marketplace.prestataires(id) ON DELETE RESTRICT,
  type_garde               purama_marketplace.type_garde NOT NULL,
  debut_le                 timestamptz NOT NULL,
  fin_le                   timestamptz NOT NULL,
  recurrence               purama_marketplace.recurrence NOT NULL DEFAULT 'aucune',
  serie_id                 uuid,
  tarif_cents              integer NOT NULL CHECK (tarif_cents > 0),
  frais_service_cents      integer NOT NULL CHECK (frais_service_cents >= 0),
  total_client_cents       integer GENERATED ALWAYS AS (tarif_cents + frais_service_cents) STORED,
  statut                   purama_marketplace.statut_reservation NOT NULL DEFAULT 'brouillon',
  stripe_payment_intent_id text UNIQUE,
  stripe_transfer_id       text,
  transfert_demande_le     timestamptz,
  transfert_confirme_le    timestamptz,
  annule_le                timestamptz,
  motif_annulation         text,
  remboursement_cents      integer,
  est_demo                 boolean NOT NULL DEFAULT false,
  cree_le                  timestamptz NOT NULL DEFAULT now(),
  maj_le                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creneau_valide CHECK (fin_le > debut_le)
);
CREATE INDEX reservations_gardien_idx
  ON purama_marketplace.reservations (app_id, prestataire_id, debut_le);

CREATE TABLE purama_marketplace.reservation_animaux (
  app_id         text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  reservation_id uuid NOT NULL REFERENCES purama_marketplace.reservations(id) ON DELETE CASCADE,
  animal_id      uuid NOT NULL REFERENCES purama_marketplace.animaux(id) ON DELETE CASCADE,
  PRIMARY KEY (reservation_id, animal_id)
);

CREATE TABLE purama_marketplace.journal_garde (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id            text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  reservation_id    uuid NOT NULL REFERENCES purama_marketplace.reservations(id) ON DELETE CASCADE,
  auteur_profil_id  uuid NOT NULL REFERENCES purama_marketplace.profils(id) ON DELETE CASCADE,
  type              purama_marketplace.type_entree_journal NOT NULL,
  message           text,
  photo_path        text,
  trace_points      jsonb,
  trace_interrompue boolean NOT NULL DEFAULT false,
  distance_m        integer CHECK (distance_m IS NULL OR distance_m >= 0),
  duree_s           integer CHECK (duree_s   IS NULL OR duree_s   >= 0),
  survenu_le        timestamptz NOT NULL DEFAULT now(),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entree_non_vide CHECK (
    message IS NOT NULL OR photo_path IS NOT NULL OR trace_points IS NOT NULL
  )
);
CREATE INDEX journal_reservation_idx
  ON purama_marketplace.journal_garde (app_id, reservation_id, survenu_le DESC);

CREATE TABLE purama_marketplace.avis (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  reservation_id   uuid NOT NULL UNIQUE REFERENCES purama_marketplace.reservations(id) ON DELETE CASCADE,
  auteur_profil_id uuid NOT NULL REFERENCES purama_marketplace.profils(id) ON DELETE CASCADE,
  prestataire_id   uuid NOT NULL REFERENCES purama_marketplace.prestataires(id) ON DELETE CASCADE,
  note             integer NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire      text,
  est_demo         boolean NOT NULL DEFAULT false,
  cree_le          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purama_marketplace.stripe_events (
  event_id  text PRIMARY KEY,
  app_id    text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  type      text NOT NULL,
  recu_le   timestamptz NOT NULL DEFAULT now(),
  traite_le timestamptz,
  erreur    text,
  payload   jsonb
);

CREATE TABLE purama_marketplace.mouvements_argent (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  reservation_id   uuid REFERENCES purama_marketplace.reservations(id) ON DELETE SET NULL,
  categorie        purama_marketplace.categorie_mouvement NOT NULL,
  montant_cents    integer NOT NULL,
  devise           text NOT NULL DEFAULT 'eur',
  reference_stripe text,
  cree_le          timestamptz NOT NULL DEFAULT now()
);

-- Fonction mon_profil_id() créée APRÈS la table profils (ordre corrigé suite bug 2026-08-07)
CREATE OR REPLACE FUNCTION purama_marketplace.mon_profil_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = purama_marketplace, public AS $$
  SELECT p.id FROM purama_marketplace.profils p
  WHERE p.user_id = auth.uid()
    AND p.app_id  = purama_marketplace.current_app_id()
  LIMIT 1;
$$;
