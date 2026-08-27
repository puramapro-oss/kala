-- 0007_legal_core_marketplace.sql — socle légal NIYAMA, variante app_id-scopée pour le schéma
-- PARTAGÉ `purama_marketplace` (CONFORMITE.md 2026-08-23, gaps #2/#3/#4).
-- Appliquée par: docker exec -i supabase-db psql -U supabase_admin -d postgres
--
-- Duplique `packages/legal/sql/001_legal_core.sql` (socle générique NIYAMA-BRIEF §1) SANS
-- l'exécuter tel quel : le script générique pose `UNIQUE(user_id, doc_type)` sans colonne
-- `app_id`, ce qui aurait mélangé les acceptations CGU/cookies/suppressions de PASHU avec
-- celles des AUTRES apps marketplace cohabitant sur `purama_marketplace` — blocage sciemment
-- posé et documenté (ERRORS.md 2026-08-23, PIEGES.md §16). Cette variante ajoute `app_id` sur
-- les 3 tables, exactement comme le fait déjà `0001_marketplace_core.sql` pour toutes les
-- tables propres à PASHU (`apps(app_id)` en registre multi-tenant, `current_app_id()` en RLS).
--
-- Non exécutée à ce jour (cf CONFORMITE.md gap #2/#3/#4) — reste bloqué par un problème
-- d'infra distinct et documenté ailleurs : le GUC PostgREST partagé du VPS n'expose
-- actuellement PAS `purama_marketplace` (ERRORS.md 2026-08-23, 3e entrée), ce qui ferait
-- échouer toute route utilisant ces tables même une fois créées. À exécuter en même temps
-- que la résolution de ce point infra, puis régénérer `src/types/database.ts` et retirer
-- `src/lib/legal/pending-tables.ts` + les casts `asPendingRow(...)` associés.

SET search_path TO purama_marketplace, public;

-- 1. Preuve d'acceptation CGU/CGV/politique de confidentialité, versionnée et horodatée,
--    scopée par app_id (un même user_id peut avoir des acceptations distinctes par app
--    cohabitante sur ce schéma).
CREATE TABLE IF NOT EXISTS purama_marketplace.legal_acceptances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL CHECK (doc_type IN ('mentions', 'cgu', 'cgv', 'confidentialite')),
  version     TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip          INET,
  user_agent  TEXT,
  UNIQUE (app_id, user_id, doc_type)
);

CREATE INDEX IF NOT EXISTS legal_acceptances_app_user_idx
  ON purama_marketplace.legal_acceptances (app_id, user_id);

ALTER TABLE purama_marketplace.legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_acceptances_select ON purama_marketplace.legal_acceptances;
CREATE POLICY legal_acceptances_select ON purama_marketplace.legal_acceptances FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS legal_acceptances_insert ON purama_marketplace.legal_acceptances;
CREATE POLICY legal_acceptances_insert ON purama_marketplace.legal_acceptances FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
-- UPDATE requise pour l'upsert(onConflict:'app_id,user_id,doc_type') (fix piège #195,
-- ré-acceptation après bump de version) — sans cette policy, la branche UPDATE de l'upsert
-- échoue silencieusement en RLS pour authenticated.
DROP POLICY IF EXISTS legal_acceptances_update ON purama_marketplace.legal_acceptances;
CREATE POLICY legal_acceptances_update ON purama_marketplace.legal_acceptances FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());

-- 2. Consentement cookies — 1 ligne par (app_id, user_id) : le visiteur anonyme reste en
--    localStorage seul côté client (hooks/useCookieConsent.ts), aucune ligne ici pour lui.
CREATE TABLE IF NOT EXISTS purama_marketplace.cookie_consents (
  app_id     text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  necessaire BOOLEAN NOT NULL DEFAULT true,
  mesure     BOOLEAN NOT NULL DEFAULT false,
  marketing  BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, user_id)
);

ALTER TABLE purama_marketplace.cookie_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cookie_consents_select ON purama_marketplace.cookie_consents;
CREATE POLICY cookie_consents_select ON purama_marketplace.cookie_consents FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS cookie_consents_insert ON purama_marketplace.cookie_consents;
CREATE POLICY cookie_consents_insert ON purama_marketplace.cookie_consents FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS cookie_consents_update ON purama_marketplace.cookie_consents;
CREATE POLICY cookie_consents_update ON purama_marketplace.cookie_consents FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());

-- 3. Demandes de suppression de compte avec période de grâce (RGPD art. 17). Le compte
--    (auth.users) reste unifié écosystème (CLAUDE.md §12) — cette ligne trace QUELLE app a
--    initié la demande et évite qu'un upsert(onConflict:'user_id') depuis PASHU n'écrase/entre
--    en collision avec une demande initiée depuis une autre app marketplace cohabitante.
CREATE TABLE IF NOT EXISTS purama_marketplace.account_deletion_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id         text NOT NULL REFERENCES purama_marketplace.apps(app_id),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for  TIMESTAMPTZ NOT NULL,
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executing', 'completed', 'cancelled')),
  cancelled_at   TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  UNIQUE (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_due_idx
  ON purama_marketplace.account_deletion_requests (status, scheduled_for);

ALTER TABLE purama_marketplace.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_deletion_requests_select ON purama_marketplace.account_deletion_requests;
CREATE POLICY account_deletion_requests_select ON purama_marketplace.account_deletion_requests FOR SELECT TO authenticated
  USING (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS account_deletion_requests_insert ON purama_marketplace.account_deletion_requests;
CREATE POLICY account_deletion_requests_insert ON purama_marketplace.account_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS account_deletion_requests_update ON purama_marketplace.account_deletion_requests;
CREATE POLICY account_deletion_requests_update ON purama_marketplace.account_deletion_requests FOR UPDATE TO authenticated
  USING      (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid())
  WITH CHECK (app_id = purama_marketplace.current_app_id() AND user_id = auth.uid());

-- Le rôle service_role (cron de suppression quotidien) contourne RLS nativement, aucune policy
-- supplémentaire n'est nécessaire pour le sweep.
