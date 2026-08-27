/**
 * Types temporaires des 3 tables du socle légal (`legal_acceptances`, `cookie_consents`,
 * `account_deletion_requests`) tant qu'elles ne sont pas migrées sur `purama_marketplace`
 * (migration bloquée — schéma partagé nécessite un `app_id` non géré par le script générique,
 * cf ERRORS.md 2026-08-23). Reflète 1:1 `migrations/0007_legal_core_marketplace.sql` (variante
 * app_id-scopée, PAS `packages/legal/sql/001_legal_core.sql` générique qui ne filtre pas par
 * app_id — cf CONFORMITE.md gap #2/#3/#4, cette variante n'est pas encore exécutée en base).
 *
 * Une fois la migration exécutée et `src/types/database.ts` régénéré, ce fichier et les casts
 * qui l'utilisent (`as unknown as PendingXRow[]`) doivent être supprimés — même discipline que
 * les autres casts "table pas encore dans les types générés" déjà en usage dans ce repo
 * (cf ERRORS.md 2026-08-14, `AnimalInsertReel`).
 */
export interface PendingLegalAcceptanceRow {
  id: string;
  app_id: string;
  user_id: string;
  doc_type: 'mentions' | 'cgu' | 'cgv' | 'confidentialite';
  version: string;
  accepted_at: string;
  ip: string | null;
  user_agent: string | null;
}

export interface PendingCookieConsentRow {
  app_id: string;
  user_id: string;
  necessaire: boolean;
  mesure: boolean;
  marketing: boolean;
  updated_at: string;
}

export interface PendingAccountDeletionRequestRow {
  id: string;
  app_id: string;
  user_id: string;
  requested_at: string;
  scheduled_for: string;
  reason: string | null;
  status: 'scheduled' | 'executing' | 'completed' | 'cancelled';
  cancelled_at: string | null;
  completed_at: string | null;
}
