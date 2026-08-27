/**
 * /devenir-prof — Formulaire de candidature prof (EX-019, EX-021, EX-024, EX-027)
 * Un utilisateur connecté peut créer/éditer son profil prestataire.
 * Soumission → statut en_attente + notification admin.
 * Stripe Connect obligatoire (blocage si non actif).
 * Mention : le prof perçoit 100 % de son tarif affiché.
 */

'use client';

import { useState, useEffect, FormEvent } from 'react';
import { createClient } from '@/lib/supabase';
import { APP_ID } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import type { Database } from '@/types/database';
import Button from '@/components/ui/Button';
import CardTitle from '@/components/ui/CardTitle';
import {
  lireReferenceVerif,
  lireStatutVerif,
  champsReferenceVerif,
  champsVerifInitiaux,
} from '@/lib/verification-prof';

export default function DevenirProfPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profilId, setProfilId] = useState<string | null>(null);
  const [prestataireExistant, setPrestataireExistant] = useState<Database['purama_marketplace']['Tables']['prestataires']['Row'] | null>(null);

  // Formulaire
  const [titre, setTitre] = useState('');
  const [presentation, setPresentation] = useState('');
  const [commune, setCommune] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [latitude, setLatitude] = useState<number>(46.85);
  const [longitude, setLongitude] = useState<number>(6.16);
  const [rayonKm, setRayonKm] = useState<number>(15);

  // EX-001 : extrait vidéo 30 s — lien direct lisible par un <video> (fichier .mp4/.webm/.mov)
  const [video30sUrl, setVideo30sUrl] = useState('');

  // Prestations (2 types de cours KALA : à domicile / chez le prof)
  const [domicilePrix, setDomicilePrix] = useState<number | null>(null);
  const [visitePrix, setVisitePrix] = useState<number | null>(null);

  // Stripe Connect
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [payoutsActifs, setPayoutsActifs] = useState(false);

  // Vérification prof : référence du justificatif (diplôme / expérience), vérifiée par l'admin
  const [referenceVerif, setReferenceVerif] = useState('');
  const [dateVerif, setDateVerif] = useState('');
  const [verifAdminFait, setVerifAdminFait] = useState(false);

  useEffect(() => {
    async function fetchUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/devenir-prof');
        return;
      }

      // Fetch profil
      const { data: profil } = await supabase
        .schema('purama_marketplace')
        .from('profils')
        .select('id')
        .eq('app_id', APP_ID)
        .eq('user_id', user.id)
        .single();

      if (!profil) {
        setError('Profil introuvable. Créez un compte complet avant de devenir prof.');
        setLoading(false);
        return;
      }
      setProfilId(profil.id);

      // Fetch prestataire existant (édition)
      const { data: prest } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .select('*')
        .eq('app_id', APP_ID)
        .eq('profil_id', profil.id)
        .single();

      if (prest) {
        setPrestataireExistant(prest);
        setTitre(prest.titre || '');
        setPresentation(prest.presentation || '');
        setCommune(prest.commune || '');
        setCodePostal(prest.code_postal || '');
        setLatitude(prest.latitude || 46.85);
        setLongitude(prest.longitude || 6.16);
        setRayonKm(prest.rayon_km || 15);
        setVideo30sUrl(prest.video_30s_url || '');
        setStripeAccountId(prest.stripe_account_id || null);
        setPayoutsActifs(prest.payouts_actifs || false);
        const refVerif = lireReferenceVerif(prest);
        setReferenceVerif(refVerif.reference);
        setDateVerif(refVerif.dateDelivrance);
        setVerifAdminFait(lireStatutVerif(prest).verifie);

        // Fetch prestations existantes
        const { data: prestations } = await supabase
          .schema('purama_marketplace')
          .from('prestations')
          .select('type_garde, prix_cents')
          .eq('app_id', APP_ID)
          .eq('prestataire_id', prest.id);

        if (prestations) {
          prestations.forEach((p) => {
            const prixEuros = p.prix_cents / 100;
            // KALA : seuls 'domicile' et 'visite' sont proposés (valeurs du schéma partagé)
            if (p.type_garde === 'domicile') setDomicilePrix(prixEuros);
            if (p.type_garde === 'visite') setVisitePrix(prixEuros);
          });
        }
      }

      setLoading(false);
    }
    fetchUserData();
  }, [supabase, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    if (!profilId) {
      setError('Profil introuvable.');
      setSaving(false);
      return;
    }

    // Validation basique
    if (!titre || !presentation || !commune || !codePostal) {
      setError('Tous les champs obligatoires doivent être remplis.');
      setSaving(false);
      return;
    }

    if (!domicilePrix && !visitePrix) {
      setError('Au moins un type de cours avec tarif doit être défini.');
      setSaving(false);
      return;
    }

    // Vérification prof : la référence du justificatif est requise avant publication
    if (!referenceVerif.trim() || !dateVerif) {
      setError('La référence de votre justificatif (diplôme ou expérience) et sa date d\'obtention sont obligatoires pour publier votre profil prof.');
      setSaving(false);
      return;
    }

    // EX-001 : vidéo 30 s obligatoire sur le profil — un lien de page (YouTube…) ne se lit
    // pas dans un <video>, on exige une adresse http(s) complète (fichier direct).
    const lienVideo = video30sUrl.trim();
    let urlVideo: URL | null = null;
    if (lienVideo) {
      try {
        urlVideo = new URL(lienVideo);
      } catch {
        urlVideo = null;
      }
    }
    if (!urlVideo || (urlVideo.protocol !== 'https:' && urlVideo.protocol !== 'http:')) {
      setError('Le lien de votre vidéo de 30 secondes est obligatoire : collez l\'adresse complète du fichier vidéo (commençant par https://).');
      setSaving(false);
      return;
    }

    try {
      let prestataireId = prestataireExistant?.id;

      if (prestataireExistant) {
        // Édition (EX-020 : les colonnes protégées ne sont PAS modifiables via PATCH client)
        const { error: errUpdate } = await supabase
          .schema('purama_marketplace')
          .from('prestataires')
          .update({
            titre,
            presentation,
            commune,
            code_postal: codePostal,
            latitude,
            longitude,
            rayon_km: rayonKm,
            video_30s_url: lienVideo,
            ...champsReferenceVerif({ reference: referenceVerif.trim(), dateDelivrance: dateVerif }),
          })
          .eq('app_id', APP_ID)
          .eq('id', prestataireExistant.id);

        if (errUpdate) {
          console.error('[devenir-prof] Erreur update prestataire:', errUpdate);
          setError('Impossible de mettre à jour votre profil prof.');
          setSaving(false);
          return;
        }
      } else {
        // Création
        const baseInsert = {
          app_id: APP_ID,
          profil_id: profilId,
          titre,
          presentation,
          commune,
          code_postal: codePostal,
          latitude,
          longitude,
          rayon_km: rayonKm,
          video_30s_url: lienVideo,
          statut_verification: 'brouillon' as const,
          adresse_exacte: null,
          badge_verifie: false,
          identite_verifiee_le: null,
          entretien_video_le: null,
          karma_score: 0,
          note_moyenne: null,
          nb_avis: 0,
          nb_gardes_terminees: 0,
          stripe_account_id: null,
          payouts_actifs: false,
          est_demo: false,
        };
        type PrestataireInsert = Database['purama_marketplace']['Tables']['prestataires']['Insert'];
        const payload = {
          ...baseInsert,
          ...champsVerifInitiaux({ reference: referenceVerif.trim(), dateDelivrance: dateVerif }),
        } as unknown as PrestataireInsert;
        const { data: newPrest, error: errInsert } = await supabase
          .schema('purama_marketplace')
          .from('prestataires')
          .insert(payload)
          .select('id')
          .single();

        if (errInsert || !newPrest) {
          console.error('[devenir-prof] Erreur insert prestataire:', errInsert);
          setError('Impossible de créer votre profil prof.');
          setSaving(false);
          return;
        }
        prestataireId = newPrest.id;
      }

      // Mise à jour prestations (DELETE + INSERT pour simplifier)
      if (!prestataireId) {
        setError('ID prestataire manquant');
        setSaving(false);
        return;
      }
      await supabase
        .schema('purama_marketplace')
        .from('prestations')
        .delete()
        .eq('app_id', APP_ID)
        .eq('prestataire_id', prestataireId);

      type PrestationInsert = Database['purama_marketplace']['Tables']['prestations']['Insert'];
      const prestationsData: Array<PrestationInsert> = [];
      if (domicilePrix) prestationsData.push({ app_id: APP_ID, prestataire_id: prestataireId, type_garde: 'domicile' as const, prix_cents: Math.round(domicilePrix * 100), actif: true, est_demo: false });
      if (visitePrix) prestationsData.push({ app_id: APP_ID, prestataire_id: prestataireId, type_garde: 'visite' as const, prix_cents: Math.round(visitePrix * 100), actif: true, est_demo: false });

      if (prestationsData.length > 0) {
        const { error: errPrest } = await supabase
          .schema('purama_marketplace')
          .from('prestations')
          .insert(prestationsData);

        if (errPrest) {
          console.error('[devenir-prof] Erreur insert prestations:', errPrest);
          setError('Impossible de mettre à jour vos tarifs.');
          setSaving(false);
          return;
        }
      }

      setSuccess('Profil prof sauvegardé avec succès.');
      setSaving(false);

      // Recharger données pour mode édition
      const { data: updatedPrest } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .select('*')
        .eq('app_id', APP_ID)
        .eq('id', prestataireId)
        .single();

      if (updatedPrest) {
        setPrestataireExistant(updatedPrest);
      }
    } catch (err) {
      console.error('[devenir-prof] Exception inattendue:', err);
      setError('Une erreur interne est survenue.');
      setSaving(false);
    }
  }

  async function handleSoumettreVerification() {
    if (!prestataireExistant) {
      setError('Sauvegardez d\'abord votre profil avant de soumettre à vérification.');
      return;
    }

    // EX-024 : Stripe Connect obligatoire
    if (!stripeAccountId || !payoutsActifs) {
      setError(
        'Votre compte Stripe Connect doit être configuré et activé pour recevoir des paiements avant de pouvoir être publié. Veuillez finaliser votre inscription Stripe Connect.'
      );
      return;
    }

    // Vérification prof : la référence doit être renseignée avant toute soumission — la
    // vérification admin (référence + date confirmées) reste un contrôle séparé.
    const refExistante = lireReferenceVerif(prestataireExistant);
    if (!refExistante.reference || !refExistante.dateDelivrance) {
      setError('La référence de votre justificatif et sa date d\'obtention sont obligatoires avant de soumettre votre profil à vérification. Sauvegardez-les d\'abord.');
      return;
    }

    // EX-001 : publication bloquée sans vidéo 30 s — lu sur la ligne persistée (rafraîchie
    // après chaque sauvegarde), pas sur l'état local du champ. Double filet avec le CHECK DB
    // (migration 0008 : statut 'verifie' ⇒ video_30s_url non vide).
    if (!prestataireExistant.video_30s_url) {
      setError('Votre vidéo de 30 secondes est obligatoire avant publication : renseignez son lien puis sauvegardez votre profil.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Passer statut à 'en_attente' (EX-021)
      const { error: errUpdate } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .update({
          statut_verification: 'en_attente' as const,
        })
        .eq('app_id', APP_ID)
        .eq('id', prestataireExistant.id);

      if (errUpdate) {
        console.error('[devenir-prof] Erreur soumission vérification:', errUpdate);
        setError('Impossible de soumettre votre profil à vérification.');
        setSaving(false);
        return;
      }

      // Notification admin (EX-021) — appel API backend
      await fetch('/api/internal/notify-admin-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestataire_id: prestataireExistant.id,
          titre,
          commune,
        }),
      });

      setSuccess('Votre profil a été soumis à vérification. Un administrateur l\'examinera sous peu.');
      setSaving(false);

      // Recharger
      const { data: updatedPrest } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .select('*')
        .eq('app_id', APP_ID)
        .eq('id', prestataireExistant.id)
        .single();

      if (updatedPrest) {
        setPrestataireExistant(updatedPrest);
      }
    } catch (err) {
      console.error('[devenir-prof] Exception soumission:', err);
      setError('Une erreur interne est survenue lors de la soumission.');
      setSaving(false);
    }
  }

  return (
    // B31-2 : patron EXACT de timeline/page.tsx — `container mx-auto max-w-7xl px-6 py-8` + un
    // bloc de largeur ancré à gauche SANS mx-auto, plus jamais `max-w-3xl px-4` (gouttière 16 px
    // hors du rail commun, h1/formulaire à 352/592 au lieu de 104/344 à 1440/1920).
    <div className="container mx-auto max-w-7xl px-6 py-8">
      {/* B31-6 : colonne droite dès lors que le formulaire laisse le conteneur sous 65 % rempli —
          encart « 0 % » (déplacé, pas dupliqué) + étapes du parcours réel.
          B35-2 (passage 35, MAJEUR) : `minmax(0,48rem),360px` = 768+32+360 = 1160 px dans un
          conteneur de 1232 — bord droit à 1264 contre le rail commun 1336. `minmax(0,1fr)_360px`
          (même patron que /prof/[id] et /mes-cours) laisse la colonne formulaire absorber le
          reliquat.
          B36-2/B35-2 (passage 36, MAJEUR) : le plafond de lecture du bloc de gauche plafonnait
          encore le formulaire à 768px dans une piste de 840px (104px de trou avant l'aside) —
          retiré. Ce formulaire n'a aucun paragraphe de lecture longue (labels + champs courts),
          le plafond de lecture n'a donc pas de justification ici ; la colonne remplit désormais
          la piste comme /timeline, seule mesure de colonne conservée sur les pages à grille.
          B39-5 (passage 39, MOYEN, RÉGRESSION de cette direction) : DA mesure aside 380px pour une
          zone de contenu principal de 856px (ratio 0,44 < 0,6) — seulement 140px de défilement
          disponible pour un sticky qui ne rattrape jamais rien. Grille 2 colonnes abandonnée pour
          un flux simple : le formulaire pleine largeur, l'aside redescendue en bandeau sous lui
          (même recette que les fiches prof). */}
      <div className="space-y-8">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Devenir prof KALA</h1>
          <p className="mb-6 text-muted-foreground">
            Créez votre profil de prof de musique et loisirs, et rejoignez notre communauté de confiance.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-alerte/20 bg-alerte/10 p-4 text-sm text-alerte">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-primary-on-dark/20 bg-primary-on-dark/10 p-4 text-sm text-primary-on-dark">
              {success}
            </div>
          )}

          {loading ? (
            // B31-12 : squelette aux dimensions du formulaire — plus de « Chargement... » nu et
            // centré. Le h1 et l'encart « 0 % » (bandeau du bas) sont déjà rendus au moment où ce
            // squelette s'affiche : rien n'attend le fetch pour apparaître à l'écran.
            <div className="space-y-6" aria-hidden="true">
              <div className="h-11 animate-pulse rounded-[24px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="h-32 animate-pulse rounded-[24px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="h-11 animate-pulse rounded-[24px] md:col-span-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="space-y-4 md:col-span-4">
                  <div className="h-11 animate-pulse rounded-[24px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="h-11 animate-pulse rounded-[24px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="h-11 animate-pulse rounded-[24px] md:col-span-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-11 animate-pulse rounded-[24px] md:col-span-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-11 animate-pulse rounded-[24px] md:col-span-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="h-11 w-40 animate-pulse rounded-[24px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
        {/* Titre */}
        {/* S42-g (passage 42) : tous les `<input>` de ce formulaire mesuraient 42px de haut
            (py-2/8px + ligne de texte 24px + bordure 2px) — sous le minimum WCAG 2.5.8 (24px, déjà
            conforme) mais sous la cible de CONFORT mobile recommandée (44px). `py-2` → `py-2.5`
            (+4px de padding vertical total) sur les 7 champs `<input>` ci-dessous porte la hauteur
            effective à ~46px, sans agrandir la police ni décaler les labels (`mb-1` au-dessus de
            chaque champ, indépendant de la hauteur du champ lui-même). Le `<textarea>`
            "Présentation" n'est pas concerné (hors périmètre `<input>` de la recette S42-g). */}
        {/* GRID-FIX (2026-08-14) : remplace les `max-w-[Nch]` par champ (8 bords droits distincts
            mesurés, régression du passage précédent) par une grille 12 colonnes `gap-4` (16px)
            partagée par TOUTE la page — jamais de largeur en `ch`. Chaque champ = `col-span-N` sur
            cette même grille, `md:` (768px) comme seuil, `w-full` en dessous (1 seul bord droit
            possible sur toute la page). Calcul conteneur 1232px (max-w-7xl − px-6*2) à ≥1280px :
            12 pistes de 88px + gouttières 16px → bornes de groupe (4/8/12 colonnes) à
            x=504/920/1336, origines de groupe à x=104/520/936. Tous les champs sont dimensionnés
            pour atterrir sur CES bornes (jamais une borne intermédiaire ad hoc) → ≤3 bords droits
            distincts sur toute la page à 1440px (critère de fermeture). */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <label htmlFor="titre" className="mb-1 block text-sm font-medium">
              Titre de votre annonce <span className="text-alerte">*</span>
            </label>
            <input
              id="titre"
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Prof de guitare, patient et passionné"
              className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
        </div>

        {/* Présentation — pleine largeur, seule sur sa rangée : pas besoin de grille, `w-full`
            suffit et son bord droit coïncide avec la borne de groupe complète (12/12 = même x que
            les rangées Titre/Commune à 8/12 n'atteignent pas, mais que les tarifs et la référence
            de vérification atteignent bien — voir calcul ci-dessus). */}
        <div>
          <label htmlFor="presentation" className="mb-1 block text-sm font-medium">
            Présentation <span className="text-alerte">*</span>
          </label>
          <textarea
            id="presentation"
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            placeholder="Parlez de votre instrument, de votre expérience d'enseignement, de ce qui vous motive à transmettre..."
            rows={6}
            className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        {/* EX-001 : extrait vidéo 30 s — la signature KALA. Les élèves choisissent un prof en
            l'entendant jouer (FormeOnde30s sur la fiche), pas sur une photo : la vidéo est
            donc obligatoire et la publication est bloquée sans elle (ci-dessus + CHECK DB).
            Pleine largeur comme Présentation (borne 12/12), S42-g py-2.5 comme les 7 champs. */}
        <div>
          <label htmlFor="video30sUrl" className="mb-1 block text-sm font-medium">
            Lien de votre vidéo de 30 secondes <span className="text-alerte">*</span>
          </label>
          <input
            id="video30sUrl"
            type="url"
            value={video30sUrl}
            onChange={(e) => setVideo30sUrl(e.target.value)}
            placeholder="https://… (votre-video-30s.mp4)"
            className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Un extrait de 30 secondes où l&apos;on vous entend jouer — c&apos;est ce que les élèves écoutent pour vous choisir. Adresse complète du fichier vidéo hébergé (lien direct .mp4, pas une page YouTube ou Vimeo).
          </p>
        </div>

        {/* Commune + code postal + rayon — Commune occupe 8/12 (même borne que Titre,
            x=920), Code postal + Rayon partagent le dernier groupe de 4/12 (x=936→1336, même
            borne que Présentation/Tarifs) empilés verticalement au lieu de se scinder
            horizontalement : évite d'introduire une 4e-5e borne de bord droit ad hoc (le piège du
            passage précédent) tout en gardant chaque champ largement lisible (Commune ~816px,
            Code postal/Rayon ~400px chacun à 1440, très au-dessus du contenu réel). */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <label htmlFor="commune" className="mb-1 block text-sm font-medium">
              Commune <span className="text-alerte">*</span>
            </label>
            <input
              id="commune"
              type="text"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              placeholder="Ex : Frasne"
              className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div className="space-y-4 md:col-span-4">
            <div>
              <label htmlFor="codePostal" className="mb-1 block text-sm font-medium">
                Code postal <span className="text-alerte">*</span>
              </label>
              <input
                id="codePostal"
                type="text"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                placeholder="25560"
                className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="rayonKm" className="mb-1 block text-sm font-medium">
                Rayon d&apos;intervention (km) <span className="text-alerte">*</span>
              </label>
              <input
                id="rayonKm"
                type="number"
                value={rayonKm}
                onChange={(e) => setRayonKm(parseInt(e.target.value, 10))}
                min={1}
                max={50}
                className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>
        </div>

        {/* Tarifs (2 types de cours KALA) — 2 colonnes égales de 6/12 chacune, origines 104/720,
            bords droits 720/1336 : la 2e colonne ferme sur la borne de groupe complète (même
            grille que toutes les autres rangées ci-dessus, jamais une grille séparée). */}
        <div>
          <h3 className="mb-3 text-lg font-semibold">Vos tarifs (€/cours)</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Définissez au moins un tarif. Laissez vide le type de cours que vous ne proposez pas.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-6">
              <label htmlFor="domicilePrix" className="mb-1 block text-sm font-medium">
                À domicile (€/cours)
              </label>
              <input
                id="domicilePrix"
                type="number"
                step="0.01"
                value={domicilePrix ?? ''}
                onChange={(e) => setDomicilePrix(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="25,00"
                className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="md:col-span-6">
              <label htmlFor="visitePrix" className="mb-1 block text-sm font-medium">
                Chez le prof (€/cours)
              </label>
              <input
                id="visitePrix"
                type="number"
                step="0.01"
                value={visitePrix ?? ''}
                onChange={(e) => setVisitePrix(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="15,00"
                className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Vérification prof (KALA) — référence du justificatif (diplôme, expérience
            d'enseignement) : auto-déclarée ici (référence + date d'obtention), vérifiée ensuite
            par l'admin (/admin/verifications) avant publication du badge public. Colonnes du
            schéma partagé (migration 0006) alimentées via src/lib/verification-prof.ts. */}
        <div>
          <h3 className="mb-1 text-lg font-semibold">Justificatif de vérification prof</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Obligatoire pour enseigner via KALA : référence de votre diplôme ou de votre expérience d&apos;enseignement (avec sa date d&apos;obtention). Elle sera vérifiée par un administrateur avant publication de votre profil.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-8">
              <label htmlFor="referenceVerif" className="mb-1 block text-sm font-medium">
                Référence du justificatif <span className="text-alerte">*</span>
              </label>
              <input
                id="referenceVerif"
                type="text"
                value={referenceVerif}
                onChange={(e) => setReferenceVerif(e.target.value)}
                placeholder="Ex : DEM-JAZZ-2019-04521 (diplôme, certificat, expérience)"
                className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div className="md:col-span-4">
              <label htmlFor="dateVerif" className="mb-1 block text-sm font-medium">
                Date d&apos;obtention <span className="text-alerte">*</span>
              </label>
              <input
                id="dateVerif"
                type="date"
                value={dateVerif}
                onChange={(e) => setDateVerif(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-[color:var(--border-control)] bg-background-soft px-4 py-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>
          {prestataireExistant && (
            <p className="mt-2 text-sm">
              Statut de vérification prof :{' '}
              <span className={verifAdminFait ? 'font-medium text-primary-on-dark' : 'font-medium text-secondary-on-dark'}>
                {verifAdminFait ? 'Vérifiée par un administrateur' : 'En attente de vérification'}
              </span>
            </p>
          )}
        </div>

        {/* Boutons — B39-7 (passage 39, MOYEN) : composant `Button` (rounded-full, h-11, un seul
            rayon/graisse partagés avec le reste du produit) au lieu de boutons écrits à la main. */}
        <div className="flex gap-4">
          <Button type="submit" disabled={saving} loading={saving}>
            {saving ? 'Enregistrement...' : 'Sauvegarder'}
          </Button>

          {prestataireExistant && prestataireExistant.statut_verification === 'brouillon' && (
            <Button type="button" variant="ghost" onClick={handleSoumettreVerification} disabled={saving}>
              Soumettre à vérification
            </Button>
          )}
        </div>
          </form>
          )}

          {!loading && prestataireExistant && prestataireExistant.statut_verification !== 'brouillon' && (
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">
                Statut de vérification :{' '}
                <span
                  className={
                    prestataireExistant.statut_verification === 'verifie'
                      ? 'text-primary-on-dark'
                      : prestataireExistant.statut_verification === 'en_attente'
                        ? 'text-secondary-on-dark'
                        : 'text-alerte'
                  }
                >
                  {prestataireExistant.statut_verification === 'verifie'
                    ? 'Vérifié'
                    : prestataireExistant.statut_verification === 'en_attente'
                      ? 'En attente de vérification'
                      : 'Refusé'}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Bandeau bas (B31-6) : encart « 0 % » déplacé (texte protégé, §G — intact, juste
            repositionné) + étapes du parcours réel (statuts brouillon → en_attente → vérifié,
            copie reprise de handleSoumettreVerification/le flux réel, rien d'inventé). */}
        {/* B39-5 (passage 39) : ex-aside sticky, redescendue en bandeau 2 colonnes pleine largeur —
            même recette que les fiches prof (cf. commentaire sur le wrapper plus haut). */}
        {/* S41-e (passage 41, MOYEN) : `items-stretch` par défaut étirait la carte "Vous percevez
            100 %…" à la hauteur de sa voisine "Comment ça marche" (82px de vide interne sous son
            dernier paragraphe à 1440). `items-start` : chaque carte garde sa hauteur naturelle. */}
        <div className="grid items-start gap-6 sm:grid-cols-2">
          {/* EX-027 : mention 100 % du tarif */}
          {/* B35-6 (passage 35, MOYEN) : p-4 (16px) contre p-6 (24px) de la carte "Comment ça
              marche" juste en dessous, dans la même colonne de même largeur — texte décalé de
              9px. Carte de section (pas un item de liste) → p-6. */}
          {/* B38-21 (passage 38, MOYEN) : `border-primary/20` composait à 1,15:1 — imperceptible,
              la carte lisait comme un paragraphe vert flottant. `--primary` (laiton foncée) a une
              luminance brute trop faible pour tenir 3:1 en dessous de pleine opacité, quel que soit
              l'alpha raisonnable ; `--primary-on-dark` (déjà la variante conçue pour porter du
              contraste, cf. globals.css) recalculée à 60% d'alpha composite : 3,65:1. */}
          <div className="rounded-lg border border-primary-on-dark/60 bg-primary/5 p-6">
            <p className="text-sm font-medium text-primary-on-dark">
              Vous percevez <span className="font-bold">100 % de votre tarif affiché</span>. KALA ne prélève aucune commission sur vos revenus. Les frais de service (9 %) sont facturés au client, en plus de votre tarif.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <CardTitle tag="h3">Comment ça marche</CardTitle>
            {/* S42-e : numéros de séquence = repère secondaire (pas une valeur mise en avant) →
                font-medium (500), pas la graisse par défaut (400). */}
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-mono font-medium text-primary-on-dark">1</span>
                <span>Complétez votre profil : présentation, zone d&apos;intervention, tarifs.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-medium text-primary-on-dark">2</span>
                <span>Sauvegardez, puis soumettez-le à vérification.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-medium text-primary-on-dark">3</span>
                <span>Un administrateur l&apos;examine, puis votre profil devient visible des élèves.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
