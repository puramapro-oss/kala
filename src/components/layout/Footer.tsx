'use client';

/**
 * Footer — Marque, liens légaux, rappel 0% commission.
 * Visible toutes largeurs, padding bottom compensant BottomTabBar sous md.
 * Footer est le dernier élément de flux avant la fin réelle du document (layout.tsx) : c'est ICI,
 * pas sur le conteneur de la page, que doit vivre la réserve pour toute barre fixe supplémentaire
 * (B15-2 — un `padding-bottom` posé avant le Footer ne crée jamais d'espace APRÈS lui).
 */

import { usePathname } from 'next/navigation';
import { formatPourcent } from '@/lib/format';

export default function Footer() {
  const pathname = usePathname();
  // Fiche prof : barre CTA fixe (81px) empilée sur BottomTabBar (<md) ou seule (md-lg)
  const hasExtraFixedBar = pathname?.startsWith('/prof');
  const bottomReserve = hasExtraFixedBar ? 'pb-[184px] md:pb-[113px] lg:pb-0' : 'pb-20 md:pb-0';

  return (
    <footer className={`border-t border-border bg-background-soft/50 backdrop-blur-md ${bottomReserve}`}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Marque */}
          <div className="flex items-center gap-2">
            {/* B41-10 (passage 41) : 24px/700 hors échelle (24 est réservé au 600, cohérent avec
                Header) — mot-logo passé en semibold, taille inchangée. */}
            <span className="font-display text-2xl font-semibold text-primary-on-dark">KALA</span>
          </div>

          {/* Liens légaux. [&>a]:scroll-mb-24 (B22-8) : le défilement automatique au focus clavier
              ne connaît pas BottomTabBar (position fixed, hors du flux) — sans marge de défilement,
              le navigateur juge un lien "visible" alors qu'il est physiquement sous la barre (mesuré :
              "Confidentialité" au focus à top=755, barre occupant 741-812). `scroll-mb` réserve la
              hauteur de la barre pour que le focus dégage réellement l'élément. */}
          {/* min-h-11 items-center, pas before:-inset-y-3 (B28-4, passage 28, régression de B27-11) :
              le pseudo-élément hors-flux élargissait la zone cliquable de 12px au-dessus/en-dessous
              SANS bouger la rangée suivante — sur des lignes à seulement 28px d'écart (rangée 1: y=20-40,
              rangée 2: y=48-68 environ à 320px), les deux zones de 44px se chevauchaient de 16px et
              `elementFromPoint` sur les derniers pixels de "CGU" renvoyait "Confidentialité" (mistap
              réel, pas juste théorique). Cette fois la boîte RÉELLE du lien grandit à 44px (au lieu
              d'une zone fantôme par-dessus une boîte de 20px) : deux liens ne peuvent plus jamais se
              chevaucher, par construction — `gap-y-1` ajoute une respiration de 4px, portant l'écart
              total entre rangées à 48px, largement au-dessus de tout empiètement possible. */}
          <nav aria-label="Liens légaux" className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-foreground-muted [&>a]:scroll-mb-24 md:[&>a]:scroll-mb-0">
            <a href="/cgu" className="inline-flex min-h-11 items-center link-nav">
              CGU
            </a>
            <a href="/cgv" className="inline-flex min-h-11 items-center link-nav">
              CGV
            </a>
            <a href="/mentions-legales" className="inline-flex min-h-11 items-center link-nav">
              Mentions légales
            </a>
            <a href="/politique-confidentialite" className="inline-flex min-h-11 items-center link-nav">
              Confidentialité
            </a>
          </nav>

          {/* Rappel 0% — texte simple sans pastille visuelle dupliquée.
              Seul "0%" doit rester soudé (B18-4) — pas toute la phrase (B19-5 : `whitespace-nowrap`
              sur le `<p>` entier débordait de ~2px à 320 sous lettrage élargi AA 1.4.12).
              formatPourcent (B31-8, remplace le faux espace ml-[3px] de B25-7) : une seule règle
              pour le signe % — fine insécable U+202F réelle (code 8239), Anonymous Pro, gras. */}
          {/* S42-e : "0%" est une valeur mise en avant → 700→600 (font-bold→font-semibold), ce span
              ne contient que le mono, "de commission..." reste un texte-frère non affecté. */}
          <p className="text-sm text-foreground-muted">
            <span className="font-semibold whitespace-nowrap"><span className="font-mono">{formatPourcent(0)}</span></span> de commission pour le prof
          </p>
        </div>
      </div>
    </footer>
  );
}
