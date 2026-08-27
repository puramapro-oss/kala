import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Client Supabase pour le navigateur (Client Components).
 * db.schema='purama_marketplace' EXPLICITE (B29, passage 29) : l'ancien commentaire prétendait que
 * le schéma était « inféré depuis le type Database » — un type TypeScript n'a AUCUN effet à
 * l'exécution. Sans cette option, chaque `.from('journal_garde')` sans `.schema()` partait sur le
 * schéma `public` → 404 PostgREST silencieux : l'écran journal (B4) était en erreur pour tout
 * utilisateur connecté. Les appels qui posent déjà `.schema('purama_marketplace')` explicitement
 * restent valides (même valeur).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'purama_marketplace' },
      // Header multi-tenant (B29) : les policies RLS filtrent sur
      // `app_id = purama_marketplace.current_app_id()`, qui lit le claim JWT `app_id` OU le header
      // `x-purama-app`. Sans lui, current_app_id() vaut NULL → 0 ligne visible pour un utilisateur
      // pourtant légitime (le « Profil introuvable » du journal).
      global: { headers: { 'x-purama-app': 'kala' } },
    }
  );
}
