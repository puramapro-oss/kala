'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { translateAuthError } from '@/lib/auth-errors';
import LegalAcceptanceNotice from '@/lib/legal/components/LegalAcceptanceNotice';

// Mêmes sous-titres contextuels que login/page.tsx (B28-1 déplacé, passage 29).
interface ContexteNext {
  sousTitre: string;
  // B30-12 : même bloc riche optionnel que login/page.tsx, voir sa note identique là-bas.
  riche?: { titre: string; pilule: string; description: string };
}

const NEXT_CONTEXT: Array<[string, ContexteNext]> = [
  [
    '/devenir-prof',
    {
      sousTitre: 'Pour créer votre profil de prof, créez un compte ou connectez-vous.',
      riche: {
        titre: 'Devenir prof KALA',
        pilule: '0 % de commission',
        description: 'Vous percevez 100 % de votre tarif affiché.',
      },
    },
  ],
  ['/mes-cours', { sousTitre: 'Pour réserver un cours, créez un compte ou connectez-vous.' }],
  ['/gains', { sousTitre: 'Pour consulter vos gains de prof, connectez-vous.' }],
];

function safeNext(raw: string | null): string | null {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return null;
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setNextPath(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);

  const context = nextPath ? NEXT_CONTEXT.find(([prefix]) => nextPath.startsWith(prefix))?.[1] : undefined;
  const contextLine = context?.sousTitre;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation manuelle + noValidate sur le <form> (B28-7, passage 28) : la bulle de validation
    // native du navigateur (déclenchée par `minLength`) est non traduite, non stylée, et à hauteur
    // de viewport réduite recouvrait le bouton "Créer mon compte" lui-même. Même chemin d'erreur
    // (role="alert", lib/auth-errors.ts) que les erreurs GoTrue, pour un seul système de messages
    // sur toute la page plutôt que deux (bulle navigateur + bannière app).
    if (password.length < 8) {
      setError(translateAuthError({ message: 'Password should be at least 8 characters', code: 'weak_password' }));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(translateAuthError(error));
      setLoading(false);
    } else {
      // Preuve d'acceptation horodatée (NIYAMA, cliquer "Créer mon compte" vaut acceptation,
      // cf LegalAcceptanceNotice ci-dessous) — best-effort, ne bloque jamais la création de
      // compte si l'enregistrement échoue (le compte existe déjà côté GoTrue à ce stade).
      for (const docType of ['cgu', 'cgv', 'confidentialite']) {
        fetch('/api/legal/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType }),
        }).catch(() => {});
      }
      // Succès → destination d'origine si ?next= (B29-1, passage 29), sinon dashboard
      // (profil créé par trigger).
      router.push(nextPath || '/dashboard');
    }
  };

  const handleGoogleSignup = async () => {
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
    // <div>, pas <main> (même famille que B23-4/B22-5) : layout.tsx en fournit déjà un.
    // flex-1, pas min-h-screen (B25-8, même correctif que login/page.tsx).
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      {/* B30-12 : même rappel riche que login/page.tsx, voir sa note identique là-bas. */}
      {context?.riche && (
        <div className="w-full max-w-md text-center">
          {/* B41-10 (passage 41) : 24px/700 hors échelle (24 réservé au 600) — semibold, taille
              inchangée, reste visuellement plus léger que le h1 30/700 juste en dessous. */}
          <h2 className="font-display text-2xl font-semibold mb-3">{context.riche.titre}</h2>
          <span className="inline-flex items-center rounded-pill bg-secondary/20 border border-secondary-on-dark px-3 py-1 text-sm font-semibold text-secondary-on-dark">
            {context.riche.pilule}
          </span>
          <p className="mt-3 text-sm text-foreground-muted">{context.riche.description}</p>
        </div>
      )}
      <div className="w-full max-w-md glass rounded-lg p-8">
        <h1 className={`font-display text-3xl font-bold text-center ${contextLine ? 'mb-2' : 'mb-6'}`}>
          Créer un compte KALA
        </h1>
        {contextLine && (
          <p className="mb-6 text-center text-sm text-foreground-muted">{contextLine}</p>
        )}

        {/* role="alert" + message français (B27-3, passage 27) : même correctif que login/page.tsx. */}
        {error && (
          <div role="alert" className="mb-4 p-3 bg-alerte/10 border border-alerte/20 rounded-lg text-sm text-alerte">
            {error}
          </div>
        )}

        {/* noValidate (B28-7, passage 28) : la validation reste réelle (vérifiée dans handleSignup),
            seule la bulle native du navigateur — non traduite, non stylée dans le design system —
            est désactivée au profit du même bloc role="alert" que les erreurs GoTrue. */}
        <form onSubmit={handleSignup} noValidate className="space-y-4">
          {/* B26-1/B26-13 (passage 26) : même correctif que login/page.tsx — voir la note identique
              là-bas pour le détail (ring `--primary` brut à 2,96:1, `border-glass-border` non enregistré). */}
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
              className="w-full px-4 py-2 bg-background-soft border border-glass-border rounded-lg"
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
              minLength={8}
              aria-describedby="password-hint"
              className="w-full px-4 py-2 bg-background-soft border border-glass-border rounded-lg"
              disabled={loading}
            />
            {/* Indice permanent (B28-7) : plutôt que de laisser l'utilisateur découvrir la règle des
                8 caractères seulement après un rejet. */}
            <p id="password-hint" className="mt-1.5 text-xs text-foreground-muted">
              8 caractères minimum
            </p>
          </div>

          {/* B24-1 (passage 24) : ce bouton portait une signature entièrement différente du CTA
              primaire du reste du site (fond mousse foncé + texte blanc + 500 + rayon 24px + 40px de
              haut, contre mousse clair + texte sombre + 600 + pill + ≥44px partout ailleurs) — le
              seul bouton primaire du produit sous le minimum tactile 44px, et à l'endroit précis où
              l'app demande le plus d'engagement (créer un compte). Classes alignées à l'identique
              sur `HomeClient.tsx`/`prof/[id]/page.tsx`. px-6, pas px-4 (B26-5, passage 26) : même
              palier de padding horizontal que login/page.tsx — voir sa note identique là-bas. */}
          <LegalAcceptanceNotice actionLabel="Créer mon compte" />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-pill bg-primary-on-dark px-6 py-3 text-[#0A0A0F] font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-glass-border" />
          <span className="text-sm text-foreground-muted">ou</span>
          <div className="h-px flex-1 bg-glass-border" />
        </div>

        {/* rounded-pill + font-semibold (B25-4, même correctif que login/page.tsx). px-6 (B26-5). */}
        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full py-2 px-6 bg-background-soft border border-glass-border rounded-pill font-semibold hover:bg-glass transition disabled:opacity-50 flex items-center justify-center gap-2"
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
          Déjà un compte ?{' '}
          {/* underline permanent, pas hover:underline (même famille que B23-4).
              inline-flex min-h-11 (B28-4, passage 29) : même correctif que login/page.tsx — boîte
              réelle 44px au lieu du pseudo-élément hors flux. */}
          {/* ?next= préservé (B29-1) : même correctif que login/page.tsx. */}
          <a href={`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`} className="inline-flex min-h-11 items-center whitespace-nowrap text-primary-on-dark underline hover:opacity-80">
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
