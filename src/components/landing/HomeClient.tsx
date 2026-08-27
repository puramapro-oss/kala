'use client';

/**
 * HomeClient — Accueil KALA, partie interactive (wireframe DESIGN-PLAN §5, EX-001 à EX-013).
 * Héros : thèse "on choisit son prof en l'entendant jouer, pas en lisant sa bio" + CTA.
 * Carte des 5 profs les plus proches SANS session requise.
 * Géoloc navigateur → fallback code postal (EX-003).
 * B23-6 : reçoit `initialProfs` rendus côté serveur par `src/app/page.tsx` — cette liste de
 * démarrage évite l'écran "5 rectangles gris" pour tout visiteur sans JavaScript (crawler, aperçu
 * de lien, chunk qui n'arrive pas) ; `CarteProfs` ne refait un fetch client que si `coords`
 * change réellement (géoloc résolue ou recherche par code postal).
 */

import { useState, useEffect } from 'react';
import CarteProfs, { type Prof } from '@/components/landing/CarteProfs';
import HeroFormeOnde from '@/components/landing/HeroFormeOnde';
import { formatPourcent } from '@/lib/format';

interface Coords {
  lat: number;
  lon: number;
}

interface HomeClientProps {
  initialProfs: Prof[];
}

export default function HomeClient({ initialProfs }: HomeClientProps) {
  const [coords, setCoords] = useState<Coords | null>(null);
  // B20-4 : 3e état explicite `null` = résolution géoloc en attente. La réserve de hauteur (CLS,
  // B19-6) ne doit exister que pendant CET état, jamais après résolution — sinon le cas "accordée"
  // (l'issue la plus fréquente) garde un vide permanent (114px mesuré) qui ne sert jamais personne.
  const [geolocRefused, setGeolocRefused] = useState<boolean | null>(null);
  const [codePostal, setCodePostal] = useState('');
  // B23-1 : `codePostalSubmitted` garde le champ MONTÉ après une recherche réussie — avant ce
  // correctif, un succès mettait `geolocRefused` à `false`, ce qui démontait le seul bloc qui
  // contrôlait `coords` (impasse : aucun moyen de corriger ou de relancer une recherche).
  const [codePostalSubmitted, setCodePostalSubmitted] = useState(false);
  const [codePostalError, setCodePostalError] = useState<string | null>(null);
  // true quand le code saisi n'est pas dans `mockGeocode` : les coordonnées retournées sont un repli
  // (Frasne), pas une correspondance réelle — les distances affichées ne doivent alors plus prétendre
  // être exactes (B23-1 : "À proximité"/"3,2 km" pour un point situé à 430km était pire qu'une absence).
  const [codePostalUnreliable, setCodePostalUnreliable] = useState(false);
  const [lastSearchedCode, setLastSearchedCode] = useState('');

  useEffect(() => {
    // EX-003 : tenter la géoloc navigateur
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setGeolocRefused(false);
        },
        (error) => {
          console.warn('Géolocalisation refusée ou échouée:', error);
          // B18-8 : ne pas fixer coords ici — geolocRefused && !coords doit rester vrai
          // pour monter le fallback code postal (2 setState de la même passe seraient batchés).
          setGeolocRefused(true);
        }
      );
    } else {
      setGeolocRefused(true);
    }
  }, []);

  const handleCodePostalSubmit = async () => {
    // B23-1 : un code de longueur ≠ 5 provoquait un `return` muet, sans le moindre retour visuel.
    if (!codePostal || codePostal.length !== 5) {
      setCodePostalError('Le code postal doit contenir 5 chiffres.');
      return;
    }
    setCodePostalError(null);

    // Simplification V1 : mapping hardcodé commune → coords (production réelle utiliserait une API géocodage)
    // EX-003 : Frasne 25560 = fallback par défaut
    const mockGeocode: Record<string, Coords> = {
      '25560': { lat: 46.85, lon: 6.16 },
      '25300': { lat: 46.9, lon: 6.33 },
      '25000': { lat: 47.24, lon: 6.02 },
    };

    const known = mockGeocode[codePostal];
    setLastSearchedCode(codePostal);
    setCodePostalUnreliable(!known);
    setCoords(known || { lat: 46.85, lon: 6.16 });
    setCodePostalSubmitted(true);
  };

  return (
    // <div>, pas <main> (B22-5) : layout.tsx en fournit déjà un ("flex-1") — un second <main> imbriqué
    // annonçait deux régions principales à un lecteur d'écran (axe-core landmark-no-duplicate-main).
    <div className="bg-background pb-[88px] md:pb-0">
      {/* Héros — composition asymétrique (non centrée, 2 colonnes desktop → 1 colonne mobile) */}
      <section className="relative overflow-hidden py-4 md:py-16 short:!py-1 shortp:!py-2">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--primary)]/10 via-transparent to-transparent" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            {/* Colonne gauche — contenu texte + CTA (alignement gauche au sein de la colonne, jamais centré).
                md:max-w-[520px] (B17-3) : rail unique avec le bandeau à 768 — plafonne la longueur de
                ligne du héros, sciemment différente du rail des cartes plus bas (cf. DECISIONS.md).
                Plus de `md:mx-auto` (B24-2) : centrer ce rail dans un conteneur plus large que lui
                déplaçait son bord gauche à x=124-190 entre 768 et 1023px, hors de l'axe du reste de
                la page — sans centrage, le bloc s'aligne naturellement sur le même bord que le logo.
                short: reprend le rail plein largeur et resserre les écarts verticaux (même logique que
                l'illustration ci-dessus). */}
            <div className="min-w-0 space-y-2 md:space-y-6 short:!space-y-1 shortp:!space-y-1 md:max-w-[520px] short:!max-w-none lg:max-w-none lg:mx-0">
              {/* short:!text-[42px] (B20-2) : le palier md est piloté par la LARGEUR — un paysage large
                  (812-844px) le déclenche malgré une hauteur minuscule. short: force la taille compacte
                  indépendamment de la largeur. */}
              {/* tracking-tight (B25-13) : seul le h1 de la fiche portait un interlettrage — celui de
                  la home (42 à 60px selon le palier, toujours ≥ le seuil optique "resserrer au-delà de
                  36px") n'en avait aucun. Règle désormais déclarée et cohérente aux deux endroits. */}
              {/* B41-10 (passage 41) : 36px et 48px n'appartiennent pas à l'échelle Syne à 6
                  paliers (60/42/30 en 700) — les 2 fusionnent sur le palier 42px le plus proche ;
                  30 (shortp) et 60 (lg) restaient déjà conformes, inchangés. */}
              <h1 className="font-display text-[42px] md:text-[42px] short:!text-[42px] shortp:!text-3xl lg:text-6xl font-bold tracking-tight text-foreground text-left" style={{ textWrap: 'balance' }}>
                Choisissez votre prof en l&apos;entendant jouer
              </h1>
              <p className="font-body text-lg lg:text-xl text-foreground-muted text-left max-w-xl short:text-base shortp:text-sm">
                Cours de musique et loisirs à domicile, pour les élèves de 7 à 77 ans. Zéro commission pour le
                prof, suivi du cours en direct.
              </p>

              {/* Badge 0% commission — qualificatif de l'offre, lu avant le CTA (B14-6 : laiton, alerte réservée aux erreurs).
                  min-w-0 sur le libellé (B20-1) : un enfant flex nowrap sans lui refuse de se rétrécir
                  sous son max-content et force tout le badge hors écran à police agrandie.
                  border-secondary-on-dark/bg-secondary-on-dark (B24-3) : la promesse est faite AU
                  prof (c'est sa rémunération, pas celle de l'élève) — terre porte désormais le côté
                  prof de la place de marché, laiton reste réservée au côté élève. */}
              <div className="inline-flex max-w-full items-center gap-2 px-4 py-2 short:py-1 shortp:py-1 rounded-pill bg-transparent border border-secondary-on-dark/40">
                {/* formatPourcent (B31-8, remplace le faux espace ml-[3px] de B25-7) : une seule règle
                    pour le signe % dans tout le produit — fine insécable U+202F réelle (mesurable :
                    code 8239 avant %), tout en Anonymous Pro. */}
                {/* S42-e : "0%" est une valeur mise en avant → 700→600 (font-bold→font-semibold),
                    ce span ne contient que le mono, aucun autre texte n'hérite du changement. */}
                <span className="inline-block shrink-0 px-3 py-1 rounded-pill bg-secondary-on-dark text-[#1C1F26] font-semibold text-sm">
                  <span className="font-mono">{formatPourcent(0)}</span>
                </span>
                <span className="min-w-0 text-sm font-medium text-foreground-muted">de commission pour le prof</span>
              </div>

              {/* B21-4 : les libellés des CTA doivent tenir sur une ligne à 320-375px — registre
                  télégraphique, aucun article, longueur proche pour les deux boutons. */}
              {/* B34-9 (passage 34) : flex-1/flex-[2] dimensionnait les deux CTA sur la largeur de
                  LEUR COLONNE, pas sur leur contenu — flex-none à partir de md : chaque CTA prend sa
                  largeur de contenu + padding constant ; md:justify-start aligne le bloc à gauche du
                  rail plutôt que de laisser le flex remplir toute la largeur disponible. <768 inchangé :
                  flex-1/flex-1 reste le motif voulu par B21-4 (deux libellés de longueur proche, côte
                  à côte, pleine largeur du rail — retirer flex-1 y romprait cet équilibre). */}
              <div className="flex flex-row flex-wrap gap-3 short:gap-2 md:flex-nowrap md:justify-start">
                {/* border-[3px] border-transparent (B20-3) : sans bord d'auteur, le mode couleurs forcées
                    supprime bg-primary-on-dark et ne laisse aucune forme — un bord transparent (coût nul
                    en rendu normal) devient un bord système visible sous forced-colors, plus épais que
                    celui du CTA secondaire (border-2) pour préserver la hiérarchie principal/secondaire.
                    min-w-0 (B20-1) : sans lui, ces boutons flex-1 refusent de rétrécir sous leur texte
                    max-content et débordent à police agrandie. */}
                <a
                  href="#profs"
                  className="min-w-0 flex-1 md:flex-none inline-flex items-center justify-center border-2 border-transparent px-4 md:px-8 h-14 short:!h-9 shortp:!h-9 rounded-pill bg-primary-on-dark text-[#1C1F26] font-semibold font-body text-[0.9375rem] md:text-base text-center md:whitespace-nowrap hover:opacity-90 transition-opacity shadow-lg"
                >
                  Voir profs
                </a>
                <a
                  href="/devenir-prof"
                  className="min-w-0 flex-1 md:flex-none inline-flex items-center justify-center px-4 md:px-8 h-14 short:!h-9 shortp:!h-9 rounded-pill border-2 border-primary-on-dark text-primary-on-dark font-semibold font-body text-[0.9375rem] md:text-base text-center md:whitespace-nowrap hover:bg-primary-on-dark hover:text-[#1C1F26] transition-colors"
                >
                  Devenir prof
                </a>
              </div>
            </div>

            {/* Colonne droite — panneau forme d'onde desktop lg+.
                aspect-[16/10] (B32-4) : le panneau reste une texture d'ambiance, pas un contenu —
                cadré large, il accompagne le titre sans peser sur le premier écran. */}
            <div className="hidden lg:block lg:self-center">
              <HeroFormeOnde className="w-full aspect-[16/10]" />
            </div>
          </div>

          {/* Panneau mobile/tablette : bandeau pleine largeur SOUS le bloc texte.
              B31-1 (MAJEUR, passage 31) : rendu AU-DESSUS du h1, le panneau occupait 30 % du fold à
              375 et 38 % à 768. À 1440, où le panneau passe à droite du titre, le défaut
              disparaissait : problème d'ordre, pas de dessin. Le premier mot du produit passe devant ;
              cible mesurable h1.y < 0,25 × viewportHeight à 375 et 768.
              B33-1/B34-3/B35-1 (fix successifs sur le ratio et les paliers `short`) : la boîte garde
              `aspect-[16/10]` et une largeur `w-full` (= le rail, comme le `h2` voisin) — SANS aucun
              `max-h` à md/lg ; en paysage très bas (`short:`), le panneau est plafonné en HAUTEUR,
              jamais en largeur (`short:!w-auto short:!h-[26svh]`), le ratio calcule alors la largeur
              depuis la hauteur. Surface pleine alignée sur le bord commun, jamais centrée ni
              plafonnée comme du texte. */}
          <HeroFormeOnde className="lg:hidden short:!block mt-4 short:mt-0 w-full aspect-[16/10] short:!w-auto short:!h-[26svh]" />
        </div>
      </section>

      {/* Carte des profs — EX-001 : liste visible immédiatement SANS session */}
      <section id="profs" className="py-12 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-6">
          {/* B41-10 (passage 41) : 36px (lg) hors échelle — un titre de section reste au palier
              30 ou 24 (jamais 42, réservé au H1), donc fixé à 30px aux deux largeurs plutôt que
              remonté. */}
          <h2 className="font-display text-3xl font-bold text-foreground mb-2">
            Profs vérifiés près de chez vous
          </h2>
          <p className="text-foreground-muted mb-8 max-w-2xl">
            Tous nos profs ont passé un entretien vidéo et une vérification d&apos;identité.
          </p>

          {/* Repli code postal (EX-003, B18-8) — ancré ici plutôt que dans le héros (B19-1) : sert
              directement la section qu'il filtre, plutôt que de gonfler un flux au budget vertical déjà
              serré (D-067) selon un état (géoloc refusée) qui ne se sait qu'après le premier rendu.
              B20-4 : la réserve `min-h-[50px]` (B19-6, anti-CLS) ne vaut que tant que `geolocRefused`
              est `null` (résolution en attente) — dès qu'elle est tranchée, soit le champ occupe sa
              propre hauteur (refusée), soit RIEN n'est réservé (accordée, l'issue la plus fréquente :
              114px de vide permanent avant ce correctif). Le seul décalage possible se produit entre
              l'état "en attente" et sa résolution, avant que l'utilisateur n'ait eu le temps de
              descendre jusqu'ici — CLS revérifié après ce changement, pas supposé. */}
          {geolocRefused === null ? (
            <div className="min-h-[50px] mb-8" />
          ) : geolocRefused || codePostalSubmitted ? (
            <div className="mb-8">
              {/* min-w-0 flex-1 sur l'input (B20-1) : un <input> sans largeur explicite a une taille
                 intrinsèque qui grandit avec la police (attribut `size` par défaut du navigateur,
                 ~20 caractères) — sans min-w-0, ce flex-item refuse de rétrécir sous elle et déborde
                 avec le bouton "OK" à sa suite à police agrandie.
                 <form> + onSubmit (B25-1, CRITIQUE) : l'input vivait hors de tout <form>, sans
                 onKeyDown — taper 5 chiffres puis Entrée (le geste naturel d'un élève pressé)
                 ne déclenchait STRICTEMENT rien, aucun retour, alors qu'un clic sur OK fonctionnait.
                 e.preventDefault() : empêche le rechargement de page qu'un <form> natif déclenche par
                 défaut sur soumission. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCodePostalSubmit();
                }}
                className="flex items-center gap-3"
              >
                {/* border-glass-border, pas border-white/35 (B27-8, passage 27) : le token partagé
                    --border (0,16, 1,53:1) reste adapté aux séparateurs (pied de page, en-tête) mais un
                    CHAMP DE SAISIE est un composant d'interface soumis au 1.4.11 AA (3:1 non-textuel) —
                    mesuré 1,53:1 avant B24-6, sous le seuil. `border-white/35` avait fermé la mesure
                    (~3,1:1) mais créé une 3e valeur de bordure isolée à cet unique champ, alors que
                    `glass-border` (0,34, ~3,02:1, calculé) sert déjà exactement ce rôle — carte de
                    connexion, champs d'auth, bouton Google, cartes de la home (B26-1/13). Même token
                    partout où le rôle est "bordure de surface/composant d'interface".
                    inputMode/autoComplete (B25-12) : sans eux, un téléphone ouvrait un clavier
                    alphabétique AZERTY pour taper 5 chiffres, et l'autoremplissage du code postal
                    enregistré par le système ne se proposait jamais.
                    max-w-[200px] au lieu de flex-1 (B26-11, passage 26) : `flex-1` remplissait tout
                    l'espace disponible du rail (1148px mesuré à 1440 pour taper 5 chiffres, 3,6× le CTA
                    principal) — le poids visuel doit suivre l'importance de l'action, pas la place libre
                    dans son conteneur flex.
                    B37-6 (passage 37, MINEUR) : `--border-control` (créé au passage 35/36, dédié au
                    rôle "bordure de contrôle de formulaire") n'existait pas encore à l'époque de
                    B27-8 — ce champ restait sur `--glass-border`, seul survivant de ce rôle. */}
                {/* placeholder « Code postal » seul (B30-11, passage 30) : « Code postal (ex: 25560) »
                    mesurait 182px pour 168px de zone utile — rendu tronqué « Code postal (ex: 2556 »,
                    l'exemple amputé induisait un format à 4 chiffres. Le placeholder porte le rôle,
                    jamais l'exemple ; le format est déjà garanti par inputMode/maxLength/le filtre. */}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="Code postal"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="min-w-0 w-full max-w-[200px] px-4 py-3 rounded-full bg-background-soft/50 backdrop-blur-md border border-[color:var(--border-control)] text-foreground placeholder:text-muted-foreground font-body"
                  maxLength={5}
                  aria-invalid={!!codePostalError}
                  aria-describedby={codePostalError ? 'code-postal-error' : undefined}
                />
                {/* B25-4 : « OK » exécute la recherche — le cœur de l'action de cette section — mais
                    portait la variante `Button.tsx` `primary` : une DEUXIÈME couleur d'action et la
                    plus petite hauteur du produit sur son geste le plus important. Restylé à
                    l'identique du CTA « Voir profs » (même fond, même texte, même graisse, même
                    pilule, 48px — le palier standard partagé avec « Réserver un cours » et les
                    boutons de connexion/inscription). */}
                <button
                  type="submit"
                  className="shrink-0 rounded-pill bg-primary-on-dark px-6 py-3 text-[#1C1F26] font-semibold transition hover:opacity-90"
                >
                  OK
                </button>
              </form>
              {/* B23-1 : un code hors zone renvoyait une "proximité" calculée depuis Frasne sans le
                  dire — traité comme un résultat explicite, pas comme un repli muet. Les distances
                  elles-mêmes sont supprimées côté CarteProfs (prop `distancesUnreliable`) : une
                  distance fausse est pire qu'une distance absente. */}
              {codePostalError && (
                <p id="code-postal-error" role="alert" className="mt-2 text-sm text-alert">
                  {codePostalError}
                </p>
              )}
              {codePostalUnreliable && !codePostalError && (
                <p className="mt-2 text-sm text-foreground-muted">
                  Aucun prof vérifié à {lastSearchedCode} pour l&apos;instant. Voici nos profs les plus proches, dans le Doubs.
                </p>
              )}
            </div>
          ) : null}

          <CarteProfs coords={coords} distancesUnreliable={codePostalUnreliable} initialProfs={initialProfs} />
        </div>
      </section>
    </div>
  );
}
