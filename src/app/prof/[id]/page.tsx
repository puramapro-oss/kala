/**
 * /prof/[id] — Fiche publique du prof (EX-014 à EX-016, EX-026)
 * Consultable sans compte. Badge vérifié + phrase explicative, karma score recalculé serveur,
 * tarifs, avis vérifiés, zone d'intervention (commune).
 */

import { createServiceClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import { notFound } from 'next/navigation';
import type { Database } from '@/types/database';
import { Metadata } from 'next';
import Card from '@/components/ui/Card';
import CardTitle from '@/components/ui/CardTitle';
import AvatarInitiale from '@/components/ui/AvatarInitiale';
import NoteProf from '@/components/ui/NoteProf';

type PrestationRow = Database['purama_marketplace']['Tables']['prestations']['Row'];
type AvisRow = Database['purama_marketplace']['Tables']['avis']['Row'];

// KALA : libellés des types de cours (valeurs DB type_garde inchangées)
const LABEL_TYPE_COURS: Record<string, string> = {
  domicile: 'À domicile',
  visite: 'Chez le prof',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServiceClient<Database, 'purama_marketplace'>();

  const { data: prest } = await supabase
    .schema('purama_marketplace')
    .from('prestataires')
    .select('titre, presentation, commune, profil_id')
    .eq('app_id', APP_ID)
    .eq('id', id)
    .single();

  if (!prest) {
    return { title: 'Prof introuvable · KALA' };
  }

  // B22-4(d) : `og:title`/`<title>` disaient la fonction, jamais la personne — le prénom est la
  // première chose qu'on veut lire en partageant un profil.
  const { data: profil } = await supabase
    .schema('purama_marketplace')
    .from('profils')
    .select('affichage_nom')
    .eq('app_id', APP_ID)
    .eq('id', prest.profil_id)
    .single();
  const prenom = profil?.affichage_nom || prest.titre;

  return {
    title: `${prenom}, prof à ${prest.commune} · KALA`,
    description: prest.presentation.slice(0, 160),
    openGraph: {
      title: `${prenom}, prof à ${prest.commune} · KALA`,
      description: prest.presentation.slice(0, 160),
      images: [`/api/og?type=prof&id=${id}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${prenom}, prof à ${prest.commune} · KALA`,
      description: prest.presentation.slice(0, 160),
      images: [`/api/og?type=prof&id=${id}`],
    },
  };
}

export default async function ProfPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createServiceClient<Database, 'purama_marketplace'>();

  // 1. Fetch prof vérifié
  const { data: prest, error: errPrest } = await supabase
    .schema('purama_marketplace')
    .from('prestataires')
    .select('*')
    .eq('app_id', APP_ID)
    .eq('id', id)
    .single();

  if (errPrest || !prest || prest.statut_verification !== 'verifie') {
    // EX-018 : seuls profs vérifiés visibles publiquement
    notFound();
  }

  // 2. Fetch profil associé
  const { data: profil } = await supabase
    .schema('purama_marketplace')
    .from('profils')
    .select('affichage_nom, avatar_url')
    .eq('app_id', APP_ID)
    .eq('id', prest.profil_id)
    .single();

  // 3. Fetch prestations (tarifs + types de cours)
  const { data: prestations } = await supabase
    .schema('purama_marketplace')
    .from('prestations')
    .select('type_garde, prix_cents')
    .eq('app_id', APP_ID)
    .eq('prestataire_id', prest.id)
    .eq('actif', true);

  // 4. Fetch avis vérifiés (EX-025 : uniquement depuis réservation statut=terminee)
  // auteur_profil_id ajouté (§E-8 passage 30) : « sur une place de marché de confiance, un avis
  // sans prénom vaut la moitié d'un avis signé » — le prénom de l'auteur se résout ci-dessous.
  const { data: avis } = await supabase
    .schema('purama_marketplace')
    .from('avis')
    .select('note, commentaire, cree_le, auteur_profil_id')
    .eq('app_id', APP_ID)
    .eq('prestataire_id', prest.id)
    .order('cree_le', { ascending: false })
    .limit(10);

  // Prénoms des auteurs en 1 requête groupée (pas une par avis). KALA : l'auteur d'un avis est
  // l'élève (ou son parent) — prénom seul, aucune donnée annexe inventée.
  const auteurIds = [...new Set((avis ?? []).map((a: AvisRow) => a.auteur_profil_id).filter(Boolean))];
  const prenomsAuteurs = new Map<string, string>();
  if (auteurIds.length > 0) {
    const { data: profilsAuteurs } = await supabase
      .schema('purama_marketplace')
      .from('profils')
      .select('id, affichage_nom')
      .eq('app_id', APP_ID)
      .in('id', auteurIds);
    for (const p of profilsAuteurs ?? []) {
      prenomsAuteurs.set(p.id, p.affichage_nom);
    }
  }

  const prenom = profil?.affichage_nom || 'Prof';
  const avatar = profil?.avatar_url;
  const noteAffichee = prest.note_moyenne
    ? parseFloat(String(prest.note_moyenne)).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : null;

  // EX-015 + EX-016 : badge vérifié affiché uniquement si toutes conditions remplies + phrase explicative
  // Deux lignes distinctes sans séparateur (B16-4) : évite qu'un « · » se retrouve seul en début/fin de ligne
  const badgeVerifie = prest.badge_verifie;
  const dateIdentite = badgeVerifie ? new Date(prest.identite_verifiee_le!).toLocaleDateString('fr-FR') : null;
  const dateEntretien = badgeVerifie ? new Date(prest.entretien_video_le!).toLocaleDateString('fr-FR') : null;
  // Vérification prof (KALA) : le CHECK `badge_coherent` (migration 0006, historique du schéma
  // partagé) garantit la cohérence du badge — la fiche publique affiche les 2 dates de contrôle
  // principales, jamais de numéro de document (donnée sensible côté visiteur anonyme).

  // EX-017 : karma_score est TOUJOURS recalculé serveur (ici servi tel quel depuis DB où il a été calculé par un trigger/cron)
  const karmaScore = prest.karma_score;

  return (
    <div className="bg-background">
      {/* pb-[88px] <md (S41-d, passage 41) : réserve l'espace de la BottomTabBar globale,
          réactivée sur cette route (cf. `BottomTabBar.tsx`) — même valeur que la landing
          (`HomeClient.tsx`), seule barre fixe restante sur cette page depuis que le CTA
          "Réserver un cours" est passé en flux normal (voir fin de page). Rupture à `md`
          (pas `lg` comme l'ancien `pb-24 lg:pb-8`) : la BottomTabBar elle-même est `md:hidden`,
          plus besoin de réserve au-delà. */}
      <div className="container mx-auto max-w-7xl px-6 pt-8 pb-[88px] md:pb-8">
        {/* xl:items-start (B28-5, passage 28) : `stretch` (défaut de la grille) étirait l'aside à
            la hauteur EXACTE de la colonne gauche — au prix d'un vide interne non borné, sous-produit
            de la différence de hauteur entre deux contenus indépendants. `items-start` rend à
            l'aside sa hauteur naturelle — l'égalité de hauteur des colonnes est abandonnée comme
            objectif (choix documenté, DECISIONS.md) au profit d'un espacement interne fixe et
            prévisible (32px entre blocs, cf. <aside> ci-dessous).
            Rupture à `xl`, pas `lg` (B32-3) : les avis rejoignent la colonne gauche — aligner la
            rupture de grille sur celle déjà en place pour /mes-cours, /timeline et /devenir-prof
            (`xl:grid-cols-[...] xl:items-start`, un seul gabarit 2-colonnes dans tout le produit). */}
        {/* B36-6/B37-7 (passages 36-37) : 360px de colonne latérale et gap-8 — une seule valeur
            pour tout le produit. */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_360px] xl:items-start">
        {/* Colonne principale (gauche desktop) */}
        <div>
        {/* En-tête prof. De md à avant xl : 2e colonne avec l'encart de réassurance, pour
            occuper le tiers droit resté vide entre le bandeau étroit et le pied (B17-7).
            xl:block (B18-1, CRITIQUE) : md:grid-cols-[1fr_300px] doit être réinitialisé à xl —
            l'encart passe en display:none via son propre `xl:hidden`, mais la PISTE de 300px
            survivrait sans ce reset, faisant déborder la page. */}
        <div className="mb-8 md:grid md:grid-cols-[1fr_300px] md:gap-8 xl:block">
        {/* wrapper commun identité (B27-1, passage 27) : un seul wrapper enfant direct du grid
            2-pistes, aucune valeur de `grid-template-columns` ne peut promouvoir un élément
            décoratif en colonne à lui seul. */}
        <div>
        {/* B38-2 + B38-9 (passage 38, MAJEUR) : empilement vertical (avatar au-dessus, jamais à
            côté) plutôt qu'une correction en negative margin — la colonne reste alignée au rail à
            TOUTE largeur, sans risque de faire sortir l'avatar de l'écran sur mobile. */}
        <div className="flex flex-col items-start gap-3 min-w-0">
          <AvatarInitiale prenom={prenom} photoUrl={avatar} size="clamp(72px, 25vw, 120px)" />
          <div className="min-w-0">
            {/* md:text-4xl lg:text-[2.625rem] (B21-3) : le nom du prof doit dominer les h2 de
                section. Valeurs en rem (acquis B20-6) ; 2,625rem plutôt que text-5xl(3rem) pour
                garder le rapport h1/CTA ≤2,8 face au CTA text-base=16px.
                lg:leading-[48px], pas lg:leading-[1.15] (B27-13) : seule valeur non entière de
                toute l'échelle d'interlignes de l'app — l'interligne passe en valeur entière
                explicite (48px), identique à l'intention de marge de 1,15 sans le résidu décimal. */}
            <h1 className="mb-2 text-3xl lg:text-[2.625rem] lg:leading-[48px] font-bold tracking-tight">{prenom}</h1>
            {/* B19-2 : composition sans séparateur (technique B16-4) — le nowrap déplaçait l'orphelin
                du bord de fin au bord de début plutôt que de le supprimer. */}
            <div className="mb-3 text-lg text-muted-foreground font-medium space-y-0.5">
              <p>{prest.titre}</p>
              <p>{prest.commune}</p>
            </div>

            {/* Badge vérifié + phrase explicative (EX-016) — teinte terre dédiée, distincte de l'action
                (B14-6). bg-secondary/border-secondary-on-dark (B24-3) : la vérification est un
                accomplissement du CÔTÉ PROF de la place de marché — terre porte ce rôle partout
                (avatar, badge, tuile « Devenir prof »). */}
            {badgeVerifie && dateIdentite && dateEntretien && (
              <>
                {/* max-w-full + min-w-0 sur le libellé (B20-1) : un enfant flex nowrap sans lui
                    force le badge hors écran à police agrandie. */}
                <div className="mb-2 inline-flex max-w-full min-h-8 items-center gap-2 rounded-pill bg-secondary/10 border border-secondary-on-dark/40 px-4 py-2 text-sm text-secondary-on-dark">
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.293 13.707a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L10 13.586l5.293-5.293a1 1 0 111.414 1.414l-6 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="min-w-0 font-medium">Prof vérifié</span>
                </div>
                {/* B21-7 : le mono habillait des phrases entières — seules les dates restent en
                    mono, les mots autour repassent en Inter (font-body, hérité par défaut). */}
                <div className="mb-3 text-sm text-muted-foreground space-y-0.5">
                  {/* md:whitespace-nowrap, pas whitespace-nowrap nu (B28-11a) : à 768px le retour à
                      la ligne standard cassait juste avant la date ; un `nowrap` global débordait au
                      contraire à 320-390px. Réservé à `md:` et plus, où la colonne est assez large. */}
                  {/* S42-e : ces dates sont un rôle secondaire (accompagnement) → font-medium (500). */}
                  <p className="md:whitespace-nowrap">Identité vérifiée le <span className="font-mono font-medium">{dateIdentite}</span></p>
                  <p className="md:whitespace-nowrap">Entretien vidéo réalisé le <span className="font-mono font-medium">{dateEntretien}</span></p>
                </div>
              </>
            )}

            {/* Note (EX-017) — mise en avant, composant unifié (B14-5) */}
            <div className="mb-3">
              {noteAffichee && (
                <div className="flex items-baseline gap-2">
                  <NoteProf note={noteAffichee} size="lg" />
                  {avis && avis.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ({avis.length} avis)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Karma + cours terminés — discret, mono (B15-7 : rôle utilitaire récurrent, sans
                virgule décimale). B19-2 : composition sans séparateur (technique B16-4). */}
            {/* B21-7 : seuls les nombres restent en mono. */}
            {/* S42-e : karma/nb cours = donnée secondaire d'accompagnement → font-medium (500). */}
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>Karma <span className="font-mono font-medium">{karmaScore}/100</span></p>
              <p><span className="font-mono font-medium">{prest.nb_gardes_terminees}</span> cours terminé{prest.nb_gardes_terminees > 1 ? 's' : ''} avec ce prof</p>
            </div>
          </div>
        </div>
        </div>

        {/* Colonne droite d'en-tête — visible de md à avant xl : Tarifs + réassurance, occupe le
            tiers droit sinon vide (B17-7). Borne haute `xl:hidden` (B32-3) : cède la place à
            l'aside réelle exactement là où la grille 2-colonnes de la page bascule. */}
        <div className="hidden md:block xl:hidden mt-6 md:mt-0 space-y-4">
          {prestations && prestations.length > 0 && (
            <Card className="border border-border p-4 space-y-2">
              {/* h2, pas h4 (B22-5) : le plan du document ne doit pas changer de forme selon la
                  largeur. text-lg (B27-7) : même titre, même rôle, même corps que la copie de
                  l'aside desktop. */}
              <CardTitle>Tarifs</CardTitle>
              {prestations.map((p: PrestationRow) => (
                <div
                  key={`${p.type_garde}-${p.prix_cents}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {LABEL_TYPE_COURS[p.type_garde] || p.type_garde.replace('_', ' ')}
                  </span>
                  <span className="font-semibold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {(p.prix_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              ))}
            </Card>
          )}
          <Card className="border border-border p-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary-on-dark mt-0.5">✓</span>
              <span>Paiement bloqué jusqu&apos;à la fin du cours</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-on-dark mt-0.5">✓</span>
              <span>Annulation gratuite jusqu&apos;à 48h avant</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-on-dark mt-0.5">✓</span>
              <span>Suivi photo pendant le cours</span>
            </div>
          </Card>
        </div>
        </div>

        {/* Tarifs mobile — affiché en flux normal sous md uniquement (haut de page, avant le fold,
            pour ne pas être masqué par le bloc CTA) ; repris dans la colonne droite à md, dans
            l'aside à xl+ */}
        {prestations && prestations.length > 0 && (
          <section className="mb-8 md:hidden">
            <h2 className="mb-3 text-2xl font-semibold">Tarifs</h2>
            <Card className="border border-border p-4 space-y-2 max-w-md">
              {prestations.map((p: PrestationRow) => (
                <div
                  key={`${p.type_garde}-${p.prix_cents}`}
                  className="grid grid-cols-[1fr_auto] gap-x-8 text-sm"
                >
                  <span className="text-muted-foreground">
                    {LABEL_TYPE_COURS[p.type_garde] || p.type_garde.replace('_', ' ')}
                  </span>
                  <span className="font-semibold font-mono justify-self-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {(p.prix_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              ))}
            </Card>
            {/* B43-6 (passage 43) : dupliquer le CTA ici (bloc en flux, jamais une barre fixe —
                les onglets globaux occupent déjà les 93px du bas) tout en GARDANT celui de fin de
                page, pas en le déplaçant. */}
            <a
              href={`/mes-cours?prof=${prest.id}`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-pill bg-primary-on-dark px-6 py-3 text-center text-base font-semibold text-[#0A0A0F] shadow-lg transition hover:opacity-90"
            >
              Réserver un cours
            </a>
          </section>
        )}

        {/* Présentation */}
        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">Présentation</h2>
          <p className="whitespace-pre-wrap text-muted-foreground max-w-[68ch]">{prest.presentation}</p>
        </section>

        {/* Zone d'intervention */}
        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">Zone d&apos;intervention</h2>
          {/* B35-12 (passage 35, MINEUR) : tout chiffre de donnée est en mono.
              B41-10 : convergence sur text-sm comme les voisins. */}
          {/* S42-e : distance = donnée secondaire → font-medium (500). */}
          <p className="text-sm text-muted-foreground max-w-[68ch]">
            {prest.commune} et alentours (rayon de <span className="font-mono font-medium">{prest.rayon_km}</span> km)
          </p>
          {/* EX-006 : adresse exacte jamais exposée avant réservation confirmée */}
        </section>

        {/* Comment se passe un cours — remontée ici depuis le pied de page (B32-3) : elle vivait
            pleine largeur SOUS la grille 2 colonnes, dans un trou de colonne gauche vide. Elle
            rejoint désormais la colonne gauche, entre Zone d'intervention et Avis. */}
        {/* xl:mb-0 (B32-3, itération 2) : dernier bloc visible de la colonne gauche à xl — son
            mb-8 gonflait la hauteur de colonne face à l'aside sans séparer quoi que ce soit. */}
        <section className="mb-8 xl:mb-0">
          <h2 className="mb-3 text-2xl font-semibold">Comment se passe un cours</h2>
          {/* B38-5 (passage 38, MINEUR) : `grid-cols-[28px_1fr]` fixe le numéro dans une piste de
              largeur CONSTANTE — le texte retombe toujours à +28px, quel que soit le nombre de
              chiffres. */}
          <div className="text-muted-foreground grid gap-4 sm:grid-cols-3 space-y-0">
            <div className="grid grid-cols-[28px_1fr] gap-0">
              <span className="font-semibold text-primary-on-dark">1.</span>
              <div>
                <p className="font-medium text-foreground mb-1">Réservation confirmée</p>
                <p className="text-sm">
                  Après validation, vous recevez les coordonnées du prof. Le paiement est bloqué mais pas encore prélevé.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[28px_1fr] gap-0">
              <span className="font-semibold text-primary-on-dark">2.</span>
              <div>
                <p className="font-medium text-foreground mb-1">Pendant le cours</p>
                <p className="text-sm">
                  Le prof vous envoie des photos et des nouvelles du cours depuis la timeline. Vous pouvez échanger par message.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[28px_1fr] gap-0">
              <span className="font-semibold text-primary-on-dark">3.</span>
              <div>
                <p className="font-medium text-foreground mb-1">Fin du cours</p>
                <p className="text-sm">
                  Le cours se termine. Le paiement est débité. Vous pouvez laisser un avis sur le prof.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bloc de réassurance — visible <md uniquement, repris dans l'encart d'en-tête de md à
            avant xl (B17-7) et dans l'aside à xl+, pour ne pas dupliquer le même contenu deux fois
            sur le même écran */}
        <section className="mb-8 md:hidden">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary-on-dark mt-0.5">✓</span>
              <span>Paiement bloqué jusqu&apos;à la fin du cours</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-on-dark mt-0.5">✓</span>
              <span>Annulation gratuite jusqu&apos;à 48h avant</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-on-dark mt-0.5">✓</span>
              <span>Suivi photo pendant le cours</span>
            </div>
          </div>
        </section>

        {/* Annulation & remboursement — visible <xl (repris dans l'aside à partir de xl, B15-4).
            Borne `xl` (B32-3) : la vraie colonne d'aside ne rend ce contenu qu'à partir de `xl`. */}
        <section className="mb-8 xl:hidden">
          <h2 className="mb-3 text-2xl font-semibold">Annulation &amp; remboursement</h2>
          <div className="text-muted-foreground space-y-2">
            <p>
              Vous pouvez annuler votre réservation sans frais jusqu&apos;à 48h avant le début du cours. Au-delà, des frais d&apos;annulation s&apos;appliquent.
            </p>
            <p>
              Le paiement est bloqué jusqu&apos;à la fin du cours. Si le prof annule ou ne se présente pas, vous êtes remboursé intégralement.
            </p>
          </div>
        </section>

        </div>

        {/* Sidebar desktop — Tarifs + réassurance + annulation UNIQUEMENT (B32-3) : les avis ne
            vivent plus ici. Redevenue la colonne COURTE (Tarifs + CTA + réassurance + annulation),
            le sticky est justifié : `xl:sticky xl:top-24`, même valeur que /timeline et /mes-cours
            (l'en-tête fait 75px, 21px d'air à `top-24`), rien en dessous d'elle dans sa colonne
            pour qu'un sticky recouvre. */}
        <aside className="hidden xl:block xl:sticky xl:top-24">
          {/* space-y-8 (32px) directement sur la carte ; p-6 (B35-6) : carte de section = p-6. */}
          <Card className="border border-border p-6 space-y-8">
            {/* Tarifs */}
            {prestations && prestations.length > 0 && (
              <div className="space-y-2">
                {/* h2 (B22-5) : aligné sur le flux mobile. */}
                <CardTitle>Tarifs</CardTitle>
                {prestations.map((p: PrestationRow) => (
                  <div
                    key={`${p.type_garde}-${p.prix_cents}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {LABEL_TYPE_COURS[p.type_garde] || p.type_garde.replace('_', ' ')}
                    </span>
                    <span className="font-semibold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {(p.prix_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA — couleur mousse (action), alerte réservée aux états destructifs (B14-6).
                print:hidden (B21-1) : bouton inutile sur papier, et "Réserver" ne doit apparaître
                sur aucune version imprimée de la fiche. */}
            <a
              href={`/mes-cours?prof=${prest.id}`}
              className="print:hidden flex h-11 w-full items-center justify-center rounded-pill border-2 border-transparent bg-primary-on-dark px-6 text-center text-base font-semibold text-[#0A0A0F] shadow-lg transition hover:opacity-90"
            >
              Réserver un cours
            </a>

            {/* Bloc de réassurance sous le CTA */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-primary-on-dark mt-0.5">✓</span>
                <span>Paiement bloqué jusqu&apos;à la fin du cours</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-on-dark mt-0.5">✓</span>
                <span>Annulation gratuite jusqu&apos;à 48h avant</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-on-dark mt-0.5">✓</span>
                <span>Suivi photo pendant le cours</span>
              </div>
            </div>

            {/* Annulation & remboursement — remontée dans l'aside pour combler le vide vertical
                (B15-4). 4e enfant de la `space-y-8` — 32px au-dessus comme tous les autres. */}
            <div className="border-t border-border pt-6 space-y-2">
              {/* h2 (B22-5) : plan du document cohérent d'une largeur à l'autre. */}
              <CardTitle>Annulation &amp; remboursement</CardTitle>
              <p className="text-sm text-muted-foreground">
                Annulation gratuite jusqu&apos;à 48h avant le début du cours. Au-delà, des frais s&apos;appliquent.
              </p>
              <p className="text-sm text-muted-foreground">
                Paiement bloqué jusqu&apos;à la fin du cours : si le prof annule ou ne se présente pas, remboursement intégral.
              </p>
            </div>
          </Card>

        </aside>
        </div>

        {/* Avis vérifiés (EX-025) — un seul emplacement, en PLEINE LARGEUR DU RAIL sous les deux
            colonnes (B32-3) : pleine largeur du rail, pas de la colonne. Les deux colonnes se
            terminent à hauteur comparable et les avis respirent sur toute la largeur. La carte
            "pas encore d'avis" reste à 686px (texte, règle B25-11). */}
        {/* mt-16 (B33-8, passage 33) : la charnière entre l'argumentaire et la preuve sociale
            mérite PLUS d'air que les 32px des autres sections — 64px, le plus grand gap de la
            page, voulu. */}
        <section id="avis" className="mt-16 mb-8 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-semibold">Avis vérifiés</h2>
          {avis && avis.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AvisCards avis={avis} prenomsAuteurs={prenomsAuteurs} />
            </div>
          ) : (
            // B23-7 : une donnée déjà connue (karma, cours terminés) remplace le silence par un
            // signal de confiance réel, sur une carte ramenée à sa taille utile.
            // max-w-[686px] en pixels fixes, pas 68ch (B25-11) : `ch` se calcule sur la police de
            // CET élément — un pixel fixe garantit la même largeur exacte que les <p> voisins.
            <Card className="max-w-[686px] border border-border p-4 text-sm text-muted-foreground">
              {prest.nb_gardes_terminees > 0 ? (
                <p>
                  {/* S42-e : même rôle secondaire que le bloc karma/cours en tête de fiche → font-medium (500). */}
                  Pas encore d&apos;avis écrit, mais {prenom} a déjà terminé{' '}
                  <span className="font-mono font-medium">{prest.nb_gardes_terminees}</span> cours{prest.nb_gardes_terminees > 1 ? 's' : ''} avec un
                  karma de <span className="font-mono font-medium">{karmaScore}/100</span>.
                </p>
              ) : (
                <p>Aucun avis pour le moment. {prenom} débute sur KALA.</p>
              )}
            </Card>
          )}
        </section>

        {/* CTA mobile/tablette — S41-d (passage 41) : bloc en FLUX NORMAL en fin de page, jamais
            une barre fixe — les onglets globaux (BottomTabBar) restent la seule barre fixe, la
            navigation principale reste accessible partout. */}
        <div className="lg:hidden mt-8 rounded-2xl border border-border bg-background-soft p-4">
          <div className="flex items-center justify-between gap-4">
            {prestations && prestations.length > 0 && (
              <div className="leading-tight">
                <p className="text-xs text-foreground-muted whitespace-nowrap">À partir de</p>
                {/* B41-10 : mono à 14px, aligné sur le palier IBM Plex Mono 12/14/20. */}
                <p className="text-sm font-semibold text-foreground font-mono whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {(Math.min(...prestations.map((p: PrestationRow) => p.prix_cents)) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </p>
              </div>
            )}
            {/* B20-1 (CRITIQUE) : le libellé doit rester intégralement lisible, quitte à prendre
                2 lignes (police agrandie, feuille AA 1.4.12).
                print:hidden (B21-1) : "Réserver" absent de toute version imprimée. */}
            <a
              href={`/mes-cours?prof=${prest.id}`}
              className="print:hidden min-w-0 shrink rounded-pill bg-primary-on-dark px-6 py-3 xshort:py-2 text-center text-base font-semibold leading-tight text-[#0A0A0F] shadow-lg transition hover:opacity-90"
            >
              Réserver un cours
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AvisCards — cartes d'avis signées, rendues à DEUX emplacements : un seul markup, jamais deux
 * versions qui divergent.
 * Avis signé (§E-8 passage 30) : initiale + prénom de l'auteur — « un avis sans prénom vaut la
 * moitié d'un avis signé » sur une place de confiance. Pastille MOUSSE, pas AvatarInitiale
 * (terre) : terre est réservé au côté prof (B24-3), l'auteur d'un avis est un élève.
 * Composition sans séparateur « · » (technique B16-4, jamais d'orphelin de ligne).
 */
function AvisCards({
  avis,
  prenomsAuteurs,
}: {
  avis: AvisRow[];
  prenomsAuteurs: Map<string, string>;
}) {
  return (
    <>
      {avis.map((a: AvisRow, idx: number) => {
        const prenomAuteur = prenomsAuteurs.get(a.auteur_profil_id);
        return (
          // B38-3 (passage 38, MAJEUR) : la CARTE ENTIÈRE devient `relative` + `pl-16`
          // (indentation gauche unique), la pastille devient `absolute left-6 top-4` — nom ET
          // commentaire héritent tous deux du `pl-16` de la carte, donc automatiquement au même
          // x, sans dépendre l'un de l'autre.
          <Card key={`${a.cree_le}-${idx}`} className="relative border border-border p-4 pl-16">
            {prenomAuteur && (
              <span className="absolute left-6 top-4 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-on-dark/15 ring-1 ring-primary-on-dark/40 font-mono text-xs font-semibold text-primary-on-dark">
                {prenomAuteur.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {prenomAuteur && (
                // B38-14 (passage 38, MOYEN) : nom remonté à 14px/600 `text-foreground` (le
                // sujet de la phrase), note en donnée d'accompagnement — pas d'inversion de
                // hiérarchie dans un produit dont la thèse est la confiance entre humains.
                <span className="text-sm font-semibold text-foreground">
                  {prenomAuteur}
                </span>
              )}
              {/* B39-9 (passage 39, MOYEN) : IBM Plex Mono, même famille que la date à droite —
                  la famille Inter est réservée au chiffre-héros unique de la page (note globale
                  `NoteProf` plus haut). */}
              {/* S42-e : la note (valeur mise en avant) reste 600, la date d'avis (secondaire)
                  passe à 500. */}
              <span className="font-mono text-sm font-semibold text-primary-on-dark">★ {a.note}/5</span>
              <span className="text-sm text-muted-foreground font-mono font-medium">
                {new Date(a.cree_le).toLocaleDateString('fr-FR')}
              </span>
            </div>
            {a.commentaire && <p className="text-sm text-muted-foreground">{a.commentaire}</p>}
          </Card>
        );
      })}
    </>
  );
}
