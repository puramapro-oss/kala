'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translateAuthError } from '@/lib/auth-errors';

// Sous-titres contextuels par destination (B28-1 déplacé, passage 29) : un visiteur envoyé ici
// depuis « Devenir prof » ou « Réserver un cours » lisait « Connexion à KALA » sans un mot sur
// ce qu'il était en train de faire. Règle par préfixe de `?next=`, pas cas par cas — toute future
// page protégée hérite du mécanisme en ajoutant une ligne.
interface ContexteNext {
  sousTitre: string;
  // B30-12 : bloc riche optionnel affiché AU-DESSUS de la carte (comme le gate `/mes-cours`,
  // qui garde son propre patron avatar+nom+prix ci-dessous, inchangé) — seul `/devenir-prof`
  // en a un pour l'instant.
  riche?: { titre: string; pilule: string; description: string };
}

const NEXT_CONTEXT: Array<[string, ContexteNext]> = [
  [
    '/devenir-prof',
    {
      sousTitre: 'Pour créer votre profil de prof, connectez-vous ou créez un compte.',
      riche: {
        titre: 'Devenir prof KALA',
        pilule: '0 % de commission',
        description: 'Vous percevez 100 % de votre tarif affiché.',
      },
    },
  ],
  ['/mes-cours', { sousTitre: 'Pour réserver un cours, connectez-vous ou créez un compte.' }],
  ['/gains', { sousTitre: 'Pour consulter vos gains de prof, connectez-vous.' }],
];

// Seuls les chemins internes relatifs sont suivis (jamais une URL absolue → open redirect).
function safeNext(raw: string | null): string | null {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // window.location plutôt que useSearchParams (pas de Suspense boundary requis au prerender —
  // la page est déjà montée côté client avant toute interaction).
  useEffect(() => {
    setNextPath(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);

  const context = nextPath ? NEXT_CONTEXT.find(([prefix]) => nextPath.startsWith(prefix))?.[1] : undefined;
  const contextLine = context?.sousTitre;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(translateAuthError(error));
      setLoading(false);
    } else {
      // Honorer ?next= (B29-1, passage 29) : la destination était ignorée — un utilisateur venu de
      // « Réserver un cours » atterrissait sur /dashboard au lieu de reprendre sa réservation.
      router.push(nextPath || '/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(translateAuthError(error));
      setLoading(false);
    }
  };

  return (
    // <div>, pas <main> (B23-4) : layout.tsx en fournit déjà un — un second imbriqué dupliquait le
    // landmark principal pour un lecteur d'écran (axe-core landmark-no-duplicate-main, même famille
    // que B22-5).
    // flex-1, pas min-h-screen (B25-8) : `main` est maintenant flex-col (layout.tsx) — `min-h-screen`
    // ici forçait 100vh EN PLUS de la hauteur déjà réservée par l'en-tête/pied dans `main`, débordant
    // la page de 176 à 264px avec un centrage visuellement asymétrique (279px au-dessus de la carte,
    // 121 en dessous). `flex-1` remplit exactement l'espace que `main` lui laisse, ni plus ni moins.
    // Plus de pb-[88px] (B28-6, clos au passage 29 par construction) : la réserve de padding du
    // passage 28 ne tenait pas dès que la bannière d'erreur allongeait la carte au-delà de l'espace
    // centré (mesuré identique 731/725 au passage 29). BottomTabBar ne s'affiche plus du tout sur
    // /login et /signup (BottomTabBar.tsx) — le chevauchement est impossible quelle que soit la
    // hauteur du viewport, et le centrage redevient symétrique.
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      {/* B30-12 : rappel du gate « Devenir prof » — un visiteur redirigé ici depuis
          `/devenir-prof` perdait toute trace du « 0 % de commission » vu sur la fiche, et
          `document.title` restait générique (« Connexion · KALA »). Le patron riche de
          `/mes-cours` (avatar+nom+prix) reste propre à ce gate-là, inchangé ci-dessous. */}
      {context?.riche && (
        <div className="w-full max-w-md text-center">
          {/* B41-10 (passage 41) : 24px/700 hors échelle (24 réservé au 600) — semibold, taille
              inchangée, même correctif que signup/page.tsx. */}
          <h2 className="font-display text-2xl font-semibold mb-3">{context.riche.titre}</h2>
          <span className="inline-flex items-center rounded-pill bg-secondary/20 border border-secondary-on-dark px-3 py-1 text-sm font-semibold text-secondary-on-dark">
            {context.riche.pilule}
          </span>
          <p className="mt-3 text-sm text-foreground-muted">{context.riche.description}</p>
        </div>
      )}
      <div className="w-full max-w-md glass rounded-lg p-8">
        <h1 className={`font-display text-3xl font-bold text-center ${contextLine ? 'mb-2' : 'mb-6'}`}>
          Connexion à KALA
        </h1>
        {contextLine && (
          <p className="mb-6 text-center text-sm text-foreground-muted">{contextLine}</p>
        )}

        {/* role="alert" + message français (B27-3, passage 27) : `error.message` brut de GoTrue
            affichait « Invalid login credentials » en anglais, sans être annoncé aux lecteurs d'écran
            (ni `role` ni `aria-live`) — sur le seul écran où l'utilisateur est déjà en difficulté. */}
        {error && (
          <div role="alert" className="mb-4 p-3 bg-alerte/10 border border-alerte/20 rounded-lg text-sm text-alerte">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          {/* B26-1/B26-13 (passage 26) : `focus:outline-none focus:ring-2 focus:ring-primary` masquait
              l'anneau global (`:focus-visible`, `--primary-on-dark`, 8,47:1) et le remplaçait par un
              ring `--primary` brut (2,96:1, sous AA) — retiré pour laisser la règle globale s'appliquer,
              même token que les boutons. `border-glass-border` ne générait aucun CSS (`glass-border`
              absent de tailwind.config) et retombait sur le gris par défaut de Tailwind ; enregistré.
              B37-6 (passage 37, MINEUR) : ces 2 champs + le bouton Google ci-dessous restaient sur
              `--glass-border` (0,34, ~3,08:1) au lieu de `--border-control` (0,38, ~3,3:1+, créé au
              passage 35/36) — passe le seuil dans les deux cas (pas un défaut de contraste), mais
              incohérence de token pour le même rôle "bordure de contrôle de formulaire". */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg"
              disabled={loading}
            />
          </div>

          {/* B24-1 (passage 24) : signature alignée sur le CTA primaire du reste du produit — voir
              la même note dans `signup/page.tsx`. px-6, pas px-4 (B26-5, passage 26) : palier de
              padding horizontal unique avec OK/Se connecter (header)/Réserver un cours — px-4 était
              un 3e palier isolé sur la seule surface où l'utilisateur remplit vraiment un formulaire. */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-pill bg-primary-on-dark px-6 py-3 text-[#0A0A0F] font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-glass-border" />
          <span className="text-sm text-foreground-muted">ou</span>
          <div className="h-px flex-1 bg-glass-border" />
        </div>

        {/* rounded-pill + font-semibold (B25-4) : même correctif que le lien "Se connecter" de
            Header.tsx — un seul rayon (pill) et une seule graisse (600) sur toute la surface
            publique auditée, fond neutre inchangé (ce n'est pas l'action verte du produit).
            px-6 (B26-5) : même palier que le bouton "Se connecter" juste au-dessus. */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2 px-6 bg-background-soft border border-[color:var(--border-control)] rounded-pill font-semibold hover:bg-glass transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuer avec Google
        </button>

        <p className="mt-6 text-center text-sm text-foreground-muted">
          Pas encore de compte ?{' '}
          {/* underline permanent, pas hover:underline (B23-4) : rgb(143,180,127) sur le texte du
              paragraphe ne passe pas le contraste 3:1 exigé pour un lien sans autre distinction
              visuelle que la couleur (WCAG A link-in-text-block) — l'état par défaut doit déjà porter
              le soulignement, pas seulement au survol qu'une souris ne déclenche jamais sur tactile. */}
          {/* inline-flex min-h-11 items-center, pas before:-inset-y-3 (B28-4, passage 28/29 —
              régression de B27-11) : la boîte RÉELLE du lien grandit à 44px, même correctif que
              Footer.tsx (le pseudo-élément hors flux laissait la boîte mesurable à 17px, sous le
              minimum AA 2.5.8 de 24px, et pouvait chevaucher un voisin). */}
          {/* whitespace-nowrap (B28-11b, passage 28) : "Créer un compte" cassait sur 2 lignes à 375px,
              le soulignement (`text-decoration`) s'interrompant à la coupure — un lien à une seule
              idée reste une seule ligne, jamais coupé au hasard du flux. */}
          {/* ?next= préservé (B29-1, passage 29) : la bascule login↔signup perdait la destination —
              créer un compte depuis « Réserver une garde » abandonnait la réservation en route. */}
          <a href={`/signup${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="inline-flex min-h-11 items-center whitespace-nowrap text-primary-on-dark underline hover:opacity-80">
            Créer un compte
          </a>
        </p>
      </div>
    </div>
  );
}
