/**
 * POST /api/account/delete   — programme la suppression du compte dans 30 jours (RGPD art. 17).
 * DELETE /api/account/delete — annule une demande de suppression en cours (période de grâce).
 *
 * Copié depuis `arogya/src/app/api/account/delete/route.ts` (implémentation réelle déjà en
 * production, réutilisée telle quelle — pas de réinvention). À copier vers
 * `src/app/api/account/delete/route.ts` dans l'app cible.
 *
 * ADAPTER avant usage :
 *   - `getSupabaseServer` : import du client Supabase SSR de CETTE app (le nom exact varie
 *     d'une app à l'autre — vérifier `src/lib/supabase-server.ts`).
 *   - `checkRateLimit` : si l'app n'a pas encore `src/lib/rate-limit.ts`, retirer ce bloc
 *     (ne bloque pas la conformité RGPD, seulement une protection anti-abus additionnelle).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { APP_ID } from '@/lib/constants';
import type { PendingAccountDeletionRequestRow } from '@/lib/legal/pending-tables';

/**
 * `account_deletion_requests` n'existe pas encore dans `src/types/database.ts` (migration
 * bloquée, cf ERRORS.md 2026-08-23) — son `Insert`/`Update` généré résout donc à `never`.
 * Cast via `unknown` (jamais `any`) vers la forme réelle attendue par le script SQL du socle ;
 * à supprimer dès que la migration tourne et que les types sont régénérés.
 */
function asPendingRow(value: Partial<PendingAccountDeletionRequestRow>): never {
  return value as unknown as never;
}

const GRACE_PERIOD_DAYS = 30;

const requestSchema = z.object({
  reason: z.string().max(500).optional(),
  confirm: z.literal('DELETE_MY_ACCOUNT'),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const rate = checkRateLimit(`user:${user.id}:account-delete`);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Trop de demandes, réessaie dans une minute.' }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation invalide. Tape 'DELETE_MY_ACCOUNT' pour confirmer." }, { status: 400 });
  }

  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 3600 * 1000);

  const { error } = await supabase.from('account_deletion_requests').upsert(
    asPendingRow({
      app_id: APP_ID,
      user_id: user.id,
      scheduled_for: scheduledFor.toISOString(),
      reason: parsed.data.reason ?? null,
      status: 'scheduled',
      cancelled_at: null,
      completed_at: null,
    }),
    { onConflict: 'app_id,user_id' }
  );

  if (error) {
    return NextResponse.json({ error: 'Demande impossible.', debug: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scheduled_for: scheduledFor.toISOString(), grace_period_days: GRACE_PERIOD_DAYS });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const rate = checkRateLimit(`user:${user.id}:account-delete-cancel`);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Trop de demandes, réessaie dans une minute.' }, { status: 429 });
  }

  const { error } = await supabase
    .from('account_deletion_requests')
    .update(asPendingRow({ status: 'cancelled', cancelled_at: new Date().toISOString() }))
    .eq('app_id', APP_ID)
    .eq('user_id', user.id)
    .eq('status', 'scheduled');

  if (error) {
    return NextResponse.json({ error: 'Annulation impossible.', debug: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
