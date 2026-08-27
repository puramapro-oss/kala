/**
 * CRON — Suppression effective des comptes (RGPD art. 17). Quotidien, ex. 03:00 UTC.
 *
 * Lit `account_deletion_requests` dont `scheduled_for` ≤ now() et `status='scheduled'`.
 * Pour chaque ligne : marque 'executing' → `auth.admin.deleteUser(user_id)` (purge
 * auth.users + CASCADE sur toutes les tables FK, y compris `legal_acceptances` et
 * `cookie_consents` de ce même socle) → marque 'completed'. Échec → reste 'executing',
 * pas de retry automatique, alerte Sentry (investigation manuelle — cf PIEGES.md "RGPD
 * suppression qui ne supprime rien", ne JAMAIS renvoyer {success:true} sans DELETE réel).
 *
 * Copié depuis `arogya/src/app/api/cron/account-deletion/route.ts` (implémentation réelle
 * déjà en production). À copier vers `src/app/api/cron/account-deletion/route.ts`.
 *
 * ADAPTER : `getSupabaseService`/`getSupabaseServiceClient` selon les noms réels exportés
 * par `src/lib/supabase-server.ts` de cette app (le premier doit pouvoir appeler
 * `.auth.admin.*`, le second doit être scopé sur le schéma de l'app pour la table
 * `account_deletion_requests`).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron-auth';
import { createServiceClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DeletionRow {
  id: string;
  user_id: string;
  scheduled_for: string;
}

export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) return authError;

  const service = createServiceClient();
  const auth = service;
  const startedAt = Date.now();
  const now = new Date().toISOString();

  const { data: requests, error: rErr } = await service
    .from('account_deletion_requests')
    .select('id, user_id, scheduled_for')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .limit(100);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const list = (requests ?? []) as DeletionRow[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, note: 'no deletion request due' });
  }

  const results: Array<{ id: string; user_id: string; ok: boolean; error?: string }> = [];

  for (const req of list) {
    await service.from('account_deletion_requests').update({ status: 'executing' }).eq('id', req.id);

    try {
      const { error: authErr } = await auth.auth.admin.deleteUser(req.user_id);
      if (authErr) throw authErr;

      await service
        .from('account_deletion_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', req.id);

      results.push({ id: req.id, user_id: req.user_id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: req.id, user_id: req.user_id, ok: false, error: message });
      // TODO: capturer avec le SDK de monitoring de cette app (Sentry si présent).
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    runMs: Date.now() - startedAt,
  });
}
