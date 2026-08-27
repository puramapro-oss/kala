'use client';

/**
 * /wallet — Wallet KOSHA écosystème (EX-086, EX-087)
 * Affiche solde réel, bouton retrait (refuse sous 5€), historique mouvements.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useWallet } from '@/hooks/useWallet';
import { APP_ID, WALLET_MIN } from '@/lib/constants';
import { formatPrix, formatPourcent } from '@/lib/format';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CardTitle from '@/components/ui/CardTitle';

interface Mouvement {
  id: string;
  montant_cents: number;
  categorie: string;
  cree_le: string;
  description: string | null;
}

export default function WalletPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const wallet = useWallet(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    // Charge historique mouvements wallet
    (async () => {
      try {
        const { data: profil } = await supabase
          .from('profils')
          .select('id')
          .eq('app_id', APP_ID)
          .eq('user_id', userId)
          .maybeSingle();

        if (!profil) {
          setLoadingHistory(false);
          return;
        }

        const { data, error } = await supabase
          .from('wallet_mouvements')
          .select('id, montant_cents, categorie, cree_le, description')
          .eq('app_id', APP_ID)
          .eq('profil_id', profil.id)
          .order('cree_le', { ascending: false })
          .limit(50);

        if (error) throw error;

        setMouvements(data || []);
      } catch (err) {
        console.error('Erreur historique wallet:', err);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [userId, supabase]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < WALLET_MIN) {
      setMessage({ type: 'error', text: `Montant minimum : ${formatPrix(WALLET_MIN * 100)}` });
      return;
    }

    setWithdrawing(true);
    setMessage(null);

    const success = await wallet.withdraw(amount);

    if (success) {
      setMessage({ type: 'success', text: `Retrait de ${formatPrix(Math.round(amount * 100))} effectué` });
      setWithdrawAmount('');
      // Recharge historique
      window.location.reload();
    } else {
      setMessage({ type: 'error', text: wallet.error || 'Échec retrait' });
    }

    setWithdrawing(false);
  };

  if (wallet.loading || loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (wallet.error && !wallet.balanceEuros) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 px-6">
        <Card className="p-6 max-w-md">
          <p className="text-alerte">{wallet.error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8">
      {/* B32-6 : /wallet était la seule page connectée hors rail (h1.left 16/16/288/528) — patron
          commun container max-w-7xl px-6, comme journal/gains.
          B37-3 (passage 37, MOYEN) : `max-w-3xl` (768px) plafonnait la colonne dans une enveloppe
          de 1232px, laissant 465px de bande morte à droite (mesuré par le DA) — aucun contenu
          légitime pour une 2e colonne ici (solde/retrait/historique n'ont pas de paragraphe de
          lecture longue justifiant un plafond de largeur), donc la colonne s'élargit pour occuper
          toute l'enveloppe (104 → 1336) plutôt que d'inventer un contenu pour une piste latérale. */}
      <div className="space-y-6">
      {/* B35-12 (passage 35, MINEUR) : seul h1 de l'app à porter font-semibold(600) à ce palier
          30px — tous les autres h1 text-3xl sont font-bold(700). Règle fixée : 700 réservé aux
          h1/h2, 600 aux h3 — plus de doublon de graisse à un même palier optique. */}
      <h1 className="text-3xl font-display font-bold text-foreground">Wallet KOSHA</h1>
      <p className="text-foreground-muted">
        Votre cagnotte écosystème PURAMA. Cashback de {formatPourcent(50)} sur vos frais de service.
      </p>

      {/* Solde — B39-4 (passage 39, MOYEN) recette DA explicite : « sortir le solde de sa carte et
          en faire le héros de page ». Le `<Card>` de B38-7 (fond+bordure) contredisait cette
          consigne — un chiffre-héros de page n'est pas un module encadré parmi d'autres.
          B40-6 (passage 40) : sorti totalement de toute carte, ce bloc laissait 320px de fond nu
          en bas de page à 1440 (dernier contenu y=470, pied de page y=790). Ré-enveloppé dans une
          `<Card>` (label + montant + statut inchangés) pour combler le vide sans réintroduire le
          défaut de B39-4 : la carte porte le chiffre-héros, elle ne le dilue pas. */}
      {/* S41-f : signature visuelle propre au solde — voile dégradé subtil (primary-on-dark →
          secondary-on-dark, tokens déjà utilisés dans l'app) + bordure teintée, pour se distinguer
          de la carte "Historique" (glass/bordure standard) sans dépendre de la seule taille du
          texte. Inline style : la seule garantie de gagner sur le `background`/`border` shorthand
          déjà posés par `.glass` (spécificité identique, ordre de cascade non maîtrisable via
          `className`). Reste sobre — pas de néon, un signal discret.
          B43-8 : la carte pleine largeur (1232px) pour un montant seul ("0,00 €") ne remplissait
          que 11% de son rail (134px d'encre / 1232px) — demi-largeur (`max-w-[608px]`, le même
          module que "Côté prof" du dashboard) et le libellé + le statut passent à
          gauche pendant que le montant, monté au palier Fraunces 700 le plus haut (60px, échelle à
          6 paliers déjà établie : 700={60,42,30}), s'ancre à droite — l'encre couvre alors tout le
          rail de la carte au lieu d'un bloc empilé isolé dans son coin supérieur gauche. */}
      <Card
        className="max-w-[608px] p-6 relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, color-mix(in srgb, var(--primary-on-dark) 14%, transparent) 0%, color-mix(in srgb, var(--secondary-on-dark) 10%, transparent) 100%)',
          border: '1px solid color-mix(in srgb, var(--primary-on-dark) 45%, transparent)',
        }}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-foreground-muted">Solde disponible</p>
            {wallet.balanceEuros > 0 && (
              <p className="text-sm text-foreground-muted">
                {wallet.canWithdraw ? (
                  <span className="text-primary-on-dark font-medium">Retrait autorisé</span>
                ) : (
                  <span>Minimum {formatPrix(WALLET_MIN * 100)} requis</span>
                )}
              </p>
            )}
          </div>
          <p className="font-display text-[60px] font-bold leading-none text-primary-on-dark">
            {formatPrix(Math.round(wallet.balanceEuros * 100))}
          </p>
        </div>
      </Card>

      {/* Retrait */}
      {wallet.canWithdraw && (
        <Card className="p-6 space-y-4">
          {/* B37-5 (passage 37, MOYEN) : couleur unifiée sur text-muted-foreground (rôle "titre
              de bloc", déjà la couleur dominante du reste du produit — dashboard). */}
          <CardTitle tag="h2">Retirer des fonds</CardTitle>
          <p className="text-sm text-foreground-muted">Montant minimum : {formatPrix(WALLET_MIN * 100)}</p>
          <div className="flex gap-4">
            <input
              type="number"
              step="0.01"
              min={WALLET_MIN}
              max={wallet.balanceEuros}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder={`${WALLET_MIN},00`}
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-foreground"
              disabled={withdrawing}
            />
            <Button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount}>
              {withdrawing ? 'Traitement...' : 'Retirer'}
            </Button>
          </div>
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-primary-on-dark' : 'text-alerte'}`}>
              {message.text}
            </p>
          )}
        </Card>
      )}

      {/* Historique */}
      {/* B38-7 (passage 38) / B39-4 (passage 39) : même retour à la largeur pleine du rail que la
          carte "Solde" ci-dessus — `max-w-[720px]` supprimé, cohérent avec le reste de l'app. */}
      <Card className="p-6 space-y-4">
        {/* B37-3/B37-5 (passage 37, MOYEN) : 20px → 18px (seul singleton de l'échelle display,
            aligné sur le cran "titre de bloc" partagé par le reste du produit) ; couleur unifiée
            sur text-muted-foreground (rôle "titre de bloc"). */}
        <CardTitle tag="h2">Historique</CardTitle>

        {mouvements.length === 0 ? (
          // B38-12 (passage 38, MOYEN) : `<EmptyState>` rend son titre en `<h3>`, qui hérite (règle
          // globale globals.css h1-h6 → Fraunces) du même corps que "Historique" (h2) juste
          // au-dessus — Fraunces 18px/600 des deux côtés, à 68px d'écart, aucune hiérarchie
          // perceptible entre le titre de section et l'état vide qu'il contient. Remplacé par un
          // bloc local (même stratégie que /gains B31-13, qui évite déjà `<EmptyState>` pour la
          // même raison) : titre en `<p>` Inter 16px/500 text-muted-foreground (jamais une balise
          // de titre, jamais la famille d'affichage), remonté à 24px du titre de section (16px de
          // `space-y-4` de la carte + 8px de `pt-2` local).
          // B41-11 (passage 41, audit imagerie) : ajout de l'illustration `empty-wallet.svg`
          // (wallet ouvert + forme d'onde KALA — plus proche du vécu "rien à afficher pour
          // l'instant" que l'ancienne
          // icône 32px jamais posée ailleurs), et reformulation qui projette dans l'usage réel du
          // produit plutôt qu'un simple constat plat — sans inventer de donnée, l'état reste 100 %
          // réel (0 mouvement).
          // B43-9 (passage 43) : l'illustration (200px) restait au-dessus d'un texte plein largeur
          // (jusqu'à 1184px sur la carte "Historique" à 1440) — l'un des deux objets "flottait"
          // dans l'espace laissé par l'autre. Bloc unique centré (`mx-auto max-w-[480px]
          // text-center`), illustration ramenée à 160x117,03px (`w-40 h-[117.03px]`, ratio réel du
          // viewBox recadré sur sa boîte d'encre — plus carré, `h-40` l'aurait déformée ; hauteur
          // explicite plutôt que `h-auto` : `naturalWidth/Height` peut rester à 0 pour un <img>
          // SVG selon le moteur de rendu, ce qui collapse la hauteur à 0px avec une largeur CSS
          // seule — mesuré via Playwright), CTA réel ajouté (même route/texte que le renvoi
          // équivalent du dashboard) pour que le bloc — image + titre + corps + CTA — occupe
          // ≥75 % de sa propre largeur déclarée.
          <div className="mx-auto flex max-w-[480px] flex-col items-center pt-2 text-center">
            <img
              src="/journal-demo/empty-wallet.svg"
              alt=""
              className="mb-4 w-40 h-[117.03px]"
            />
            <p className="mb-2 text-base font-medium text-muted-foreground">Votre wallet KOSHA est encore vide</p>
            <p className="text-muted-foreground">
              Réservez un premier cours et {formatPourcent(50)} de vos frais de service viendront
              s&apos;y déposer automatiquement. Retrait possible dès {formatPrix(WALLET_MIN * 100)}.
            </p>
            <a
              href="/#profs"
              className="link-action mt-4 inline-flex min-h-11 items-center text-sm font-medium"
            >
              Trouver un prof
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {mouvements.map((m) => {
              const isCredit = m.montant_cents > 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-lg"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {m.categorie === 'cashback_karma' && 'Cashback KARMA'}
                      {m.categorie === 'retrait' && 'Retrait'}
                      {m.categorie === 'prime_parrainage' && 'Prime parrainage'}
                      {m.categorie === 'remboursement' && 'Remboursement'}
                    </p>
                    {m.description && (
                      <p className="text-sm text-foreground-muted">{m.description}</p>
                    )}
                    <p className="text-xs text-foreground-muted">
                      {new Date(m.cree_le).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p
                    className={`text-lg font-mono font-semibold ${
                      isCredit ? 'text-primary-on-dark' : 'text-foreground-muted'
                    }`}
                  >
                    {isCredit ? '+' : ''}
                    {formatPrix(m.montant_cents)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* B41-9 : grille "Comment se remplit KOSHA" — texte informatif fixe (aucune donnée dynamique
          nécessaire), comble le vide desktop identifié par le DA (265-268px) sans étirer les
          cartes existantes ni dupliquer le contenu déjà affiché plus haut (cashback/seuil déjà
          mentionnés au singulier dans le sous-titre h1 et la carte solde — ici, 3 sources
          distinctes de remplissage du wallet, jamais répétées ailleurs sous cette forme). */}
      <Card className="p-6">
        <CardTitle tag="h2">Comment se remplit KOSHA</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground-muted">
              Cashback {formatPourcent(50)} de vos frais de service à chaque garde réservée.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground-muted">
              Retrait possible dès {formatPrix(WALLET_MIN * 100)}.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground-muted">
              Wallet partagé sur tout l&apos;écosystème PURAMA.
            </p>
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}
