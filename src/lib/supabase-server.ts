import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Client Supabase pour le serveur (Server Components/Route Handlers/Server Actions).
 * Typé sur le schéma partagé `purama_marketplace`.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, 'purama_marketplace'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Même défaut de schéma que le client navigateur (B29) : un type TS ne configure rien à
      // l'exécution — sans cette option, un `.from()` non qualifié partait sur `public`.
      db: { schema: 'purama_marketplace' },
      // Header multi-tenant (B29) : cf. lib/supabase.ts — les policies RLS lisent `x-purama-app`.
      global: { headers: { 'x-purama-app': 'kala' } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookie cannot be set in Server Components
          }
        },
      },
    }
  );
}

/**
 * Client service_role pour les opérations admin/backend (JAMAIS exposé au client).
 * FIXME : typage générique simplifié (any) temporaire pour éviter le combat de types @supabase/ssr v3+.
 */
export function createServiceClient<
  _DatabaseType = Database,
  _SchemaName extends string = 'purama_marketplace'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
>(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase type inference complex
  return createServerClient<any, 'purama_marketplace'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      // Défaut de schéma explicite (B29) : gains/dashboard/api-journal font des `.from()` non
      // qualifiés sur ce client — ils partaient sur `public` (404) sans cette option.
      db: { schema: 'purama_marketplace' },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No cookies needed for service role
        },
      },
    }
  );
}
