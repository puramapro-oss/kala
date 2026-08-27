import { NextResponse, type NextRequest } from 'next/server';

/**
 * Copié tel quel depuis `arogya/src/lib/cron-auth.ts` (implémentation réelle déjà en
 * production) — canonique pour toute app dont `lib/cron-auth.ts` n'existe pas encore.
 * Copier ce fichier vers `src/lib/cron-auth.ts` dans l'app cible.
 */
export function assertCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
