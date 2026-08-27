import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * T-16 : signOut() + clear storage + redirect /login (EX-068).
 * PIEGES.md §7 : un signOut incomplet = bouton mort.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SUPABASE_URL!), {
    status: 303,
  });

  // Clear auth cookies
  response.cookies.delete('sb-auth-token');
  response.cookies.delete('sb-refresh-token');

  return response;
}
