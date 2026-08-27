'use client';

/**
 * Header — desktop/tablette visible md+, mobile compact <md.
 * Mobile : barre titre 48px, flèche retour pages secondaires, logo centré home.
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function Header() {
  const [mounted, setMounted] = useState(false);
  // B29 (passage 29) : le header affichait « Se connecter » même à l'intérieur du compte — l'état
  // d'auth n'était jamais lu. `getSession()` (lecture locale synchrone du cookie, pas d'aller-retour
  // réseau) + `onAuthStateChange` pour suivre connexion/déconnexion sans rechargement.
  const [isAuthed, setIsAuthed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setIsAuthed(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) return null;

  const isHome = pathname === '/';
  const showBackButton = !isHome && pathname.startsWith('/prof');

  // B23-5 : `history.back()` sur une fiche ouverte en lien direct (partagée, ouverte dans un nouvel
  // onglet, résultat de recherche) n'a rien à dépiler — le clic ne fait alors rien, ou pire, sort du
  // site vers une page hors KALA restée dans l'historique de l'onglet. `history.length` court-circuite
  // le cas où il n'y a tout simplement rien à dépiler ; `document.referrer` distingue une navigation
  // interne (retour légitime) d'un atterrissage direct dont l'historique du navigateur contiendrait
  // autre chose que KALA.
  const handleBack = () => {
    const cameFromSameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (window.history.length > 1 && cameFromSameOrigin) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <>
      {/* Header mobile < md */}
      {/* xshort:static (B21-5) : à hauteur de viewport minuscule (reflow WCAG 1.4.10 400%),
          un en-tête collant occupe en permanence une part disproportionnée de l'écran (49/256 = 19%
          à lui seul) — il redevient un élément de flux normal, lu une fois puis défilé, plutôt que
          de rester ancré pour toujours. xshort:h-8 réduit aussi sa hauteur propre. */}
      <header className="md:hidden sticky top-0 xshort:static z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="h-12 xshort:h-8 px-4 flex items-center justify-center relative">
          {showBackButton && (
            // w-11 h-11 (44px, B23-5) : la cible tactile réelle était les 24×24 du svg — sous le
            // minimum WCAG 2.5.5 (44×44). flex centre l'icône sans en changer la taille visuelle.
            <button
              onClick={handleBack}
              className="absolute left-2 w-11 h-11 flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
              aria-label="Retour"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {/* Link, pas <span> (B27-12, passage 27) : le mot-logo était focalisable et cliquable au
              desktop (`Link` plus bas) mais inerte au mobile — premier arrêt clavier différent selon la
              largeur (`Link "KALA"` à 1440, `Link "Se connecter"` à 375, l'en-tête mobile ne contenant
              rien de focalisable). Même affordance aux deux largeurs désormais. */}
          {/* S42-f : cible tactile du lien logo mesurée à 62×22px (sous le minimum WCAG 2.5.8,
              24×24) — `font-display` pose `line-height:1.2`, donc 18px de texte ne rend que 22px de
              haut. `py-1` (+4px haut/bas = +8px total) porte le lien à 30px SANS changer la taille du
              texte : le header reste `h-12` (48px fixe) avec `items-center justify-center`, donc ce
              padding grandit uniquement la zone cliquable dans l'espace déjà vertical disponible —
              aucun décalage de la hauteur du header ni des autres éléments (mesuré avant/après). */}
          <Link href="/" className="flex items-center gap-2 py-1">
            {/* B41-10 (passage 41) : 18px/700 hors échelle Syne à 6 paliers (18 est réservé
                au 600) — mot-logo passé en semibold, taille inchangée. */}
            <span className="font-display text-lg font-semibold text-primary-on-dark">KALA</span>
          </Link>
        </div>
      </header>

      {/* Header desktop/tablette md+ */}
      <header className="hidden md:block sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        {/* Logo + nom */}
        <Link href="/" className="flex items-center gap-3 group">
          {/* B41-10 (passage 41) : 24px/700 hors échelle (24 est réservé au 600) — mot-logo passé
              en semibold, taille inchangée. */}
          <span className="font-display text-2xl font-semibold text-primary-on-dark">KALA</span>
        </Link>

        {/* Navigation principale desktop */}
        <nav aria-label="Navigation principale" className="flex items-center gap-8">
          <Link
            href="/"
            aria-current={isHome ? 'page' : undefined}
            className="text-foreground-muted hover:text-foreground transition-colors font-medium"
          >
            Accueil
          </Link>
          {/* py-2 + font-semibold (B25-4) : recensement DA de tous les boutons/liens à fond de la
              surface publique — 5 hauteurs (40 à 62px), 3 graisses (400/500/600), 2 rayons. Ce lien
              était le seul à 46px et le seul à 400 (les autres : 40, 42 ou 48, tous 500-600). Ramené
              au palier compact partagé avec le bouton Google (40px, même graisse 600 que partout
              ailleurs sur la surface auditée) — fond/couleur neutres inchangés, ce lien reste une
              entrée de navigation, pas une action verte. */}
          {/* aria-current + style neutralisé sur /login (B26-10, passage 26) : le contrôle le plus
              appuyé du header pointait sans distinction vers la page déjà affichée — aucun signal
              d'état, un clic pour rien. Sur /login, la pilule verte perd son fond d'action (le geste
              qu'elle propose est déjà fait) et porte `aria-current`, comme « Accueil » plus haut. */}
          {/* Connecté → « Mon espace » vers /dashboard ; déconnecté → « Se connecter » (B29,
              passage 29 : le header proposait de se connecter depuis l'intérieur du compte). */}
          {isAuthed ? (
            <Link
              href="/dashboard"
              aria-current={pathname === '/dashboard' ? 'page' : undefined}
              // B35-3 (passage 35, MAJEUR) : pastille mesurée 1,53:1 de bordure — sous le seuil
              // non-textuel WCAG 1.4.11 (3:1). C'est le point d'entrée de toute la partie connectée,
              // présent sur les 9 pages. border-control (3,26:1) remplace border-border sur les
              // deux états (page courante incluse, même défaut mesuré).
              className={
                pathname === '/dashboard'
                  ? 'rounded-pill px-6 py-2 border border-[color:var(--border-control)] text-foreground-muted font-semibold cursor-default'
                  : 'rounded-pill px-6 py-2 bg-card border border-[color:var(--border-control)] text-foreground font-semibold hover:bg-primary/10 transition-colors'
              }
            >
              Mon espace
            </Link>
          ) : (
            <Link
              href="/login"
              aria-current={pathname === '/login' ? 'page' : undefined}
              // B36-1 (passage 36, MAJEUR) : jumelle déconnectée de « Mon espace » — restée sur
              // border-border (1,53:1) alors que sa variante connectée avait déjà border-control.
              // Même token que « Mon espace » sur les deux états.
              className={
                pathname === '/login'
                  ? 'rounded-pill px-6 py-2 border border-[color:var(--border-control)] text-foreground-muted font-semibold cursor-default'
                  : 'rounded-pill px-6 py-2 bg-card border border-[color:var(--border-control)] text-foreground font-semibold hover:bg-primary/10 transition-colors'
              }
            >
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}
