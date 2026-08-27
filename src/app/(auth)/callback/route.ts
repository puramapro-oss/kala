import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * T-12 (EX-064) : OAuth callback handler.
 * Échange le `code` contre une session, puis redirige.
 * DOIT être public (whitelisté dans proxy.ts).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  // EX-067 : validation `?next=` (doit commencer par `/`, jamais `//` — open redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('OAuth exchange error:', error.message);
      return NextResponse.redirect(new URL('/login?error=oauth_failed', requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
