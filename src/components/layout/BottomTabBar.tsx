'use client';

/**
 * Bottom tabs mobile — forme d'onde signature en indicateur d'onglet actif (DESIGN-PLAN §1, §5).
 * Desktop : masquée.
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Home, User } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function BottomTabBar() {
  const pathname = usePathname();
  // B29 (passage 29) : même correctif que Header.tsx — l'onglet « Connexion » restait affiché à
  // l'intérieur du compte. Connecté, il devient « Mon espace » → /dashboard.
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setIsAuthed(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  // B26-2 (passage 26, CRITIQUE, RÉSOLU DIFFÉREMMENT AU PASSAGE 41 — cf. S41-d) : la fiche prof
  // portait sa propre barre CTA fixe ("Réserver un cours") empilée sous cette barre globale — les
  // deux mangeaient 163px/29% de l'écran à 320×568 et tranchaient le contenu entre elles. Le DA du
  // passage 41 a noté que masquer entièrement la navigation principale sur la page la plus profonde
  // du tunnel était lui-même un défaut (utilisateur privé de son seul moyen de revenir à l'accueil/
  // son espace sans la flèche du header). Résolu à la racine plutôt qu'en empilant les 2 barres :
  // le CTA "Réserver un cours" est passé d'une barre FIXE à un bloc EN FLUX NORMAL, en fin de page
  // (voir `src/app/prof/[id]/page.tsx`) — il ne reste alors plus qu'UNE SEULE barre fixe (celle-ci),
  // le conflit d'origine disparaît par construction plutôt que par exception de route.

  // B28-6 (passage 28, resté ouvert au passage 29 malgré la réserve de padding — la carte centrée
  // débordait la réserve dès que la bannière d'erreur l'allongeait, à 375×812 précisément) : les
  // écrans d'auth sont des tâches uniques et focalisées, la navigation globale n'y a rien à proposer
  // que la page elle-même ne propose déjà (l'onglet « Connexion » pointe... ici). Masquer la barre y
  // supprime le chevauchement PAR CONSTRUCTION, à toutes les hauteurs de viewport — même principe que
  // la fiche prof ci-dessus, et le comportement standard des apps natives sur leurs écrans d'auth. */
  if (pathname === '/login' || pathname === '/signup') return null;

  return (
    // bg-background/95 (B22-2, CRITIQUE) : `/96` n'est pas un palier de l'échelle d'opacité Tailwind
    // (…, 90, 95, 100) — l'utilitaire n'était jamais généré, aucune erreur de build, `background-color`
    // calculé valait `rgba(0,0,0,0)` : la barre n'avait qu'un `backdrop-blur`, le contenu se lisait au
    // travers à 12,60:1 (le h2 Syne de la section suivante traversait "Accueil" en toutes lettres).
    // B26-2 (passage 26) : même symptôme à /95 (95% n'est pas 100%) — une barre de navigation fixe n'a
    // aucune raison d'être translucide, `bg-background` plein retire le risque à la source.
    <nav aria-label="Navigation par onglets" className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border">
      {/* xshort:py-1 + icônes/étiquettes réduites (B21-5) : à hauteur de viewport minuscule
          (reflow 400%), cette barre + la barre d'achat + l'en-tête occupaient 65,6% de l'écran sur
          la fiche prof — il ne restait que 88px pour lire.
          min-h-11 (44px, B27-2, passage 27) : sous `xshort` (max-height:420px, atteint en paysage
          téléphone, 667×375), le padding réduit + icône 16px faisait tomber la barre à 25px — ses
          icônes, elles, restaient à 16-24px de haut positionnées par flex, débordant de 2px SOUS le
          bord de l'écran. Un plancher de hauteur, jamais franchi quel que soit le padding, garantit que
          le contenu (icône 20px + son padding minimal) reste toujours entièrement à l'intérieur. */}
      <div className="flex items-center justify-around py-3 xshort:py-1 px-6 min-h-11">
        {/* B37-11 (passage 37, MINEUR) : l'indicateur vivait en `absolute bottom-0` d'un lien
            dont la hauteur réelle était fixée par une réserve `pb-4` — cette réserve ne
            coïncidait pas avec le bas RÉEL de la barre (le lien est un item flex `items-center`
            dans une rangée `py-3`, sa propre boîte est centrée, pas collée au bord), l'indicateur
            pendait ~18px sous le libellé au lieu d'être centré dans la barre. Remplacé par un
            slot en FLUX NORMAL (h-4, toujours réservé que l'onglet soit actif ou non — les 2
            onglets gardent la même hauteur, alignés sur la même ligne) directement sous le
            libellé, avec le même `gap-1.5` que icône↔libellé : l'indicateur suit désormais le
            rythme vertical normal de la barre au lieu d'un calcul de bord indépendant. */}
        {/* Accueil */}
        <Link
          href="/"
          aria-current={isActive('/') ? 'page' : undefined}
          className="flex flex-col items-center gap-1.5 xshort:gap-0 min-w-[64px] group"
        >
          <Home
            className={`h-6 w-6 xshort:h-5 xshort:w-5 transition-colors ${
              isActive('/') ? 'text-primary-on-dark' : 'text-foreground-muted'
            }`}
          />
          <span
            className={`text-xs font-medium transition-colors xshort:hidden ${
              isActive('/') ? 'text-primary-on-dark' : 'text-foreground-muted'
            }`}
          >
            Accueil
          </span>
          <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
            {isActive('/') && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="8" y="24" width="7" height="16" rx="3.5" fill="var(--primary-on-dark)" />
                <rect x="21" y="16" width="7" height="32" rx="3.5" fill="var(--primary-on-dark)" />
                <rect x="34" y="8" width="7" height="48" rx="3.5" fill="var(--primary-on-dark)" />
                <rect x="47" y="20" width="7" height="24" rx="3.5" fill="var(--primary-on-dark)" />
              </svg>
            )}
          </span>
        </Link>

        {/* Profil — « Mon espace » (/dashboard) connecté, « Connexion » (/login) sinon (B29) */}
        <Link
          href={isAuthed ? '/dashboard' : '/login'}
          aria-current={isActive(isAuthed ? '/dashboard' : '/login') ? 'page' : undefined}
          className="flex flex-col items-center gap-1.5 xshort:gap-0 min-w-[64px] group"
        >
          <User
            className={`h-6 w-6 xshort:h-5 xshort:w-5 transition-colors ${
              isActive(isAuthed ? '/dashboard' : '/login') ? 'text-primary-on-dark' : 'text-foreground-muted'
            }`}
          />
          <span
            className={`text-xs font-medium transition-colors xshort:hidden ${
              isActive(isAuthed ? '/dashboard' : '/login') ? 'text-primary-on-dark' : 'text-foreground-muted'
            }`}
          >
            {isAuthed ? 'Mon espace' : 'Connexion'}
          </span>
          <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
            {isActive(isAuthed ? '/dashboard' : '/login') && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="8" y="24" width="7" height="16" rx="3.5" fill="var(--primary-on-dark)" />
                <rect x="21" y="16" width="7" height="32" rx="3.5" fill="var(--primary-on-dark)" />
                <rect x="34" y="8" width="7" height="48" rx="3.5" fill="var(--primary-on-dark)" />
                <rect x="47" y="20" width="7" height="24" rx="3.5" fill="var(--primary-on-dark)" />
              </svg>
            )}
          </span>
        </Link>
      </div>
    </nav>
  );
}
