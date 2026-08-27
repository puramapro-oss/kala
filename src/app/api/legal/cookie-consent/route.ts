/**
 * POST /api/legal/cookie-consent — synchronise en base le choix de cookies d'un utilisateur
 * authentifié (préférence déjà appliquée immédiatement côté client via `useCookieConsent`/
 * localStorage — cet appel ne fait que garder une preuve indépendante du navigateur).
 * Appelé par `CookieConsentBanner` via son prop `onConsent`, uniquement si l'utilisateur est
 * connecté (le visiteur anonyme reste en localStorage seul, aucune ligne DB pour lui).
 *
 * ADAPTER : import du client Supabase SSR de cette app (voir account-delete.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import type { PendingCookieConsentRow } from '@/lib/legal/pending-tables';

const bodySchema = z.object({
  mesure: z.boolean(),
  marketing: z.boolean(),
});

/**
 * `cookie_consents` n'existe pas encore dans `src/types/database.ts` (migration bloquée,
 * cf ERRORS.md 2026-08-23) — cast via `unknown` (jamais `any`) vers la forme réelle du socle ;
 * à supprimer dès que la migration tourne et que les types sont régénérés.
 */
function asPendingRow(value: Partial<PendingCookieConsentRow>): never {
  return value as unknown as never;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Visiteur anonyme : le choix reste en localStorage seul, rien à synchroniser.
  if (!user) return NextResponse.json({ ok: true, synced: false });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { error } = await supabase.from('cookie_consents').upsert(
    asPendingRow({
      app_id: APP_ID,
      user_id: user.id,
      necessaire: true,
      mesure: parsed.data.mesure,
      marketing: parsed.data.marketing,
      updated_at: new Date().toISOString(),
    }),
    { onConflict: 'app_id,user_id' }
  );

  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible.', debug: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: true });
}
