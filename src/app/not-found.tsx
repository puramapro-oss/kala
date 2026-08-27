/**
 * 404 — page introuvable (B23-4).
 * Avant : <main> imbriqué dans le <main> de layout.tsx (double landmark, axe-core
 * landmark-no-duplicate-main), copie générique, lien souligné hors marque.
 * layout.tsx fournit déjà le <main> — cette page ne doit en rendre aucun second.
 */

import FormeOnde from '@/components/brand/FormeOnde';
import { APP_NAME } from '@/lib/constants';

// title dédié (B28-9, passage 28) : 6 écrans (dont celui-ci) partageaient tous le <title> générique
// de la home — un onglet ouvert ici ne se distinguait jamais d'un onglet resté sur l'accueil.
export const metadata = {
  title: `Page introuvable · ${APP_NAME}`,
};

export default function NotFound() {
  return (
    // flex-1, pas min-h-screen (B26-7, passage 26) : cette page vit DANS le <main flex-1 flex-col>
    // de layout.tsx (restructuré B25-8) — `min-h-screen` ici redéclare 100vh un niveau plus bas et
    // dépasse l'espace réellement disponible, exactement le bug que B25-8 avait corrigé sur
    // login/signup (et que sa propre note dans DECISIONS.md prévenait de reproduire). `flex-1` remplit
    // exactement l'espace restant, centrage vertical réel au lieu d'un vide de 120-401px au-dessus.
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <FormeOnde className="h-16 w-16 text-primary-on-dark" aria-hidden="true" />
      <div className="space-y-2">
        {/* text-3xl, pas text-2xl (B26-7) : le message principal d'une page pleine doit se
            distinguer d'un élément de marque en 3 lignes, pas s'y confondre.
            B41-10 (passage 41) : 36px (md) hors échelle Syne à 6 paliers — remonté à 42px. */}
        <h1 className="font-display text-3xl md:text-[42px] font-bold text-foreground">Cette note s&apos;est tue avant d&apos;arriver ici</h1>
        <p className="font-body text-foreground-muted max-w-sm">
          La page que vous cherchez n&apos;existe pas ou plus. Retrouvez les profs vérifiés près de chez vous.
        </p>
      </div>
      <a
        href="/#profs"
        className="rounded-pill bg-primary-on-dark px-6 py-3 font-semibold font-body text-[#1C1F26] shadow-lg transition hover:opacity-90"
      >
        Voir les profs
      </a>
    </div>
  );
}
