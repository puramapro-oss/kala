/**
 * « Ma mémoire » (NIYAMA-BRIEF.md §1, RGPD art. 15/17/20) : export de données + suppression
 * de compte. Best-effort sur `legal_acceptances`/`account_deletion_requests` (B32-9, PIEGES.md
 * §2) : ces 3 tables du socle ne sont pas encore migrées sur le schéma partagé
 * `purama_marketplace` (bloqué, cf ERRORS.md — filtrage `app_id` requis avant migration sur un
 * schéma partagé) — la page reste utilisable (export + suppression) même si l'historique
 * d'acceptations est vide en attendant.
 */
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_NAME } from '@/lib/constants';
import MaMemoirePage, { type LegalAcceptanceRow } from '@/lib/legal/components/MaMemoirePage';
import type {
  PendingLegalAcceptanceRow,
  PendingAccountDeletionRequestRow,
} from '@/lib/legal/pending-tables';

export const metadata: Metadata = {
  title: `Ma mémoire · ${APP_NAME}`,
};

export default async function MaMemoire() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let acceptations: LegalAcceptanceRow[] = [];
  const { data: acceptancesData, error: acceptancesErr } = await supabase
    .from('legal_acceptances')
    .select('doc_type, version, accepted_at')
    .eq('user_id', user.id);
  if (!acceptancesErr) {
    const rows = (acceptancesData ?? []) as unknown as Pick<
      PendingLegalAcceptanceRow,
      'doc_type' | 'version' | 'accepted_at'
    >[];
    acceptations = rows.map((a) => ({
      docType: a.doc_type,
      version: a.version,
      acceptedAt: a.accepted_at,
    }));
  }

  let deletionScheduledFor: string | null = null;
  const { data: deletionRow, error: deletionErr } = await supabase
    .from('account_deletion_requests')
    .select('scheduled_for')
    .eq('user_id', user.id)
    .eq('status', 'scheduled')
    .maybeSingle();
  if (!deletionErr) {
    const row = deletionRow as unknown as Pick<PendingAccountDeletionRequestRow, 'scheduled_for'> | null;
    deletionScheduledFor = row?.scheduled_for ?? null;
  }

  return (
    <MaMemoirePage appName={APP_NAME} acceptations={acceptations} deletionScheduledFor={deletionScheduledFor} />
  );
}
