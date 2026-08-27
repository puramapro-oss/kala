import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * T-13 : proxy.ts (JAMAIS middleware.ts — PIEGES.md §8).
 * Next.js 16+ : `export function proxy` (pas `middleware`).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
      db: {
        schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA!,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // B23-3 : liste blanche → liste noire. Avant ce correctif, TOUT chemin absent de `publicPaths`
  // (fautes de frappe, routes retirées, futures pages jamais ajoutées à la liste) était redirigé
  // vers /login au lieu de tomber sur le 404 natif de Next — masquant l'existence même d'un 404 et
  // laissant croire à un mur d'auth sur une page qui n'existe simplement pas. Seules les routes
  // effectivement protégées déclenchent désormais la redirection ; chacune vérifie de toute façon
  // sa propre session côté serveur (`supabase.auth.getUser()`), ce proxy n'est qu'une première
  // barrière — pas la seule.
  const protectedPrefixes = [
    '/dashboard',
    '/wallet',
    '/gains',
    '/cours',
    '/devenir-prof',
    '/admin',
    '/403',
  ];
  const isProtected = protectedPrefixes.some((p) => path === p || path.startsWith(`${p}/`));

  // Profil prof en lecture publique (EX-009 : recherche publique via route serveur, pas PostgREST anon)
  if (path.startsWith('/prof/')) {
    return response;
  }

  // Mes cours accessible sans auth (page affichera CTA login si nécessaire)
  if (path.startsWith('/mes-cours')) {
    return response;
  }

  // Non-auth sur route protégée → /login
  if (!user && isProtected) {
    const next = request.nextUrl.pathname + request.nextUrl.search;
    // EX-067 : validation `?next=` (doit commencer par `/`, jamais `//`)
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', safeNext);
    return NextResponse.redirect(loginUrl);
  }

  // Auth + route publique `/login` ou `/signup` → /dashboard
  if (user && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

/**
 * T-14 : matcher whitelist (manifest, icônes PWA, robots.txt, sitemap, sw.js, /icon).
 * PIEGES.md §8 : chaque fichier statique racine tombe sous le matcher par défaut → 404/redirect.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - manifest.ts / manifest.json
     * - icon (Next.js icon routes)
     * - robots.txt
     * - sitemap.xml
     * - sw.js (service worker)
     * - .well-known/apple-app-site-association
     * - api/* (API routes handle their own auth)
     *
     * B22-3 : `icon` seul n'exclut que les chemins qui COMMENCENT par "icon" (icon.svg) — pas
     * "apple-icon", qui ne partage pas ce préfixe. Next redirigeait la route générée /apple-icon
     * vers /login?next=/apple-icon pour tout visiteur non connecté.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest|icon|apple-icon|robots.txt|sitemap.xml|sw.js|.well-known|api).*)',
  ],
};
