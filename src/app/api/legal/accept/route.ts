/**
 * POST /api/legal/accept — enregistre une preuve d'acceptation horodatée (qui/quelle
 * version/quand — NIYAMA-BRIEF.md §1) d'un document légal (CGU, CGV ou politique de
 * confidentialité). Appelé automatiquement à la création de compte (acceptation de la
 * version courante) et par `LegalReacceptanceGate` quand une version change.
 *
 * La version enregistrée est TOUJOURS `CURRENT_LEGAL_VERSIONS[docType]` calculée côté
 * serveur — jamais une valeur envoyée par le client. Un client ne peut pas falsifier la
 * preuve en prétendant avoir accepté une version qu'il n'a jamais vue.
 *
 * ADAPTER : import du client Supabase SSR de cette app (voir account-delete.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CURRENT_LEGAL_VERSIONS } from '@/lib/legal/versions';
import { APP_ID } from '@/lib/constants';
import type { PendingLegalAcceptanceRow } from '@/lib/legal/pending-tables';

const bodySchema = z.object({
  docType: z.enum(['mentions', 'cgu', 'cgv', 'confidentialite']),
});

/**
 * `legal_acceptances` n'existe pas encore dans `src/types/database.ts` (migration bloquée,
 * cf ERRORS.md 2026-08-23) — cast via `unknown` (jamais `any`) vers la forme réelle du socle ;
 * à supprimer dès que la migration tourne et que les types sont régénérés.
 */
function asPendingRow(value: Partial<PendingLegalAcceptanceRow>): never {
  return value as unknown as never;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // upsert, pas insert (PIEGES.md §16) : une 2e acceptation du même app_id/user_id/doc_type
  // (version bumpée, LegalReacceptanceGate qui rappelle cet endpoint) violerait sinon la
  // contrainte UNIQUE(app_id, user_id, doc_type) posée par 0007_legal_core_marketplace.sql
  // (variante app_id-scopée du socle générique — CONFORMITE.md gap #2, pas encore exécutée).
  const { error } = await supabase.from('legal_acceptances').upsert(
    asPendingRow({
      app_id: APP_ID,
      user_id: user.id,
      doc_type: parsed.data.docType,
      version: CURRENT_LEGAL_VERSIONS[parsed.data.docType],
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent'),
    }),
    { onConflict: 'app_id,user_id,doc_type' }
  );

  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible.', debug: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
