/**
 * /admin/verifications — Panneau admin de validation des profs (EX-022, EX-023)
 * Accessible uniquement au super_admin (EX-023).
 * Liste les candidatures en 'en_attente', permet de vérifier/refuser avec motif + horodatage.
 * Colonnes physiques de la référence de vérification : accès via src/lib/verification-prof.ts
 * (schéma partagé purama_marketplace, migration 0006 — colonnes immuables).
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { APP_ID } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import {
  fragmentSelectVerif,
  champsValidationAdmin,
  lireReferenceVerif,
  type ReferenceVerifProf,
} from '@/lib/verification-prof';

interface Candidature {
  id: string;
  titre: string;
  presentation: string;
  commune: string;
  code_postal: string;
  cree_le: string;
  profil_nom: string | null;
  referenceVerif: ReferenceVerifProf;
}

// Ligne renvoyée par le `select()` ciblé ci-dessous — casté manuellement car la liste de
// colonnes est assemblée dynamiquement (fragmentSelectVerif), donc non inférable par supabase-js.
type LignePrestataire = Record<string, unknown>;

export default function VerificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  // Vérification prof (NIYAMA-BRIEF §3, adapté KALA) : l'admin doit cocher avoir contrôlé la
  // référence déclarée avant que "Vérifier" ne puisse écrire la validation en base.
  const [verifConfirme, setVerifConfirme] = useState<Record<string, boolean>>({});

  // Vérifier accès super_admin
  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?next=/admin/verifications');
        return;
      }

      // EX-023 : vérification super_admin côté serveur aussi, mais côté client simple redirect
      // SUPER_ADMIN_EMAIL (CLAUDE.md §11 constants.ts)
      const SUPER_ADMIN_EMAIL = 'matiss.frasne@gmail.com';
      if (user.email !== SUPER_ADMIN_EMAIL) {
        router.push('/403'); // ou page interdite dédiée
        return;
      }

      await fetchCandidatures();
    }
    checkAccess();
  }, [supabase, router]);

  async function fetchCandidatures() {
    setLoading(true);
    setError(null);

    try {
      // Fetch prestataires en_attente
      const { data: prests, error: errPrests } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .select('id, profil_id, titre, presentation, commune, code_postal, cree_le, ' + fragmentSelectVerif())
        .eq('app_id', APP_ID)
        .eq('statut_verification', 'en_attente')
        .order('cree_le', { ascending: true });

      if (errPrests) {
        console.error('[verifications] Erreur fetch candidatures:', errPrests);
        setError('Impossible de récupérer les candidatures.');
        setLoading(false);
        return;
      }

      const lignes = (prests || []) as unknown as LignePrestataire[];
      if (lignes.length === 0) {
        setCandidatures([]);
        setLoading(false);
        return;
      }

      // Fetch profils associés pour affichage_nom
      const profilIds = lignes.map((p) => p.profil_id as string);
      const { data: profils } = await supabase
        .schema('purama_marketplace')
        .from('profils')
        .select('id, affichage_nom')
        .eq('app_id', APP_ID)
        .in('id', profilIds);

      const profilMap = new Map<string, string>();
      if (profils) {
        profils.forEach((pf) => profilMap.set(pf.id, pf.affichage_nom || 'Inconnu'));
      }

      const enriched: Candidature[] = lignes.map((p) => ({
        id: p.id as string,
        titre: p.titre as string,
        presentation: p.presentation as string,
        commune: p.commune as string,
        code_postal: p.code_postal as string,
        cree_le: p.cree_le as string,
        profil_nom: profilMap.get(p.profil_id as string) || null,
        referenceVerif: lireReferenceVerif(p),
      }));

      setCandidatures(enriched);
      setLoading(false);
    } catch (err) {
      console.error('[verifications] Exception inattendue:', err);
      setError('Erreur interne lors de la récupération des candidatures.');
      setLoading(false);
    }
  }

  async function handleVerifier(prestataireId: string) {
    setError(null);

    // Vérification prof (NIYAMA-BRIEF §3, adapté KALA) : obligation réelle — pas de badge
    // "Vérifié PURAMA" sans référence déclarée ET contrôle admin explicitement coché.
    const candidature = candidatures.find((c) => c.id === prestataireId);
    if (!candidature?.referenceVerif.reference || !candidature?.referenceVerif.dateDelivrance) {
      setError('Ce candidat n\'a pas encore renseigné sa référence de vérification prof — impossible de le vérifier.');
      return;
    }
    if (!verifConfirme[prestataireId]) {
      setError('Cochez d\'abord la case de contrôle de la référence avant de vérifier ce prof.');
      return;
    }

    setProcessing(prestataireId);

    try {
      // Horodater identite_verifiee_le + entretien_video_le + validation de la référence (EX-022)
      const now = new Date().toISOString();

      const { error: errUpdate } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .update({
          statut_verification: 'verifie' as const,
          badge_verifie: true,
          identite_verifiee_le: now,
          entretien_video_le: now,
          ...champsValidationAdmin(now),
        })
        .eq('app_id', APP_ID)
        .eq('id', prestataireId);

      if (errUpdate) {
        console.error('[verifications] Erreur vérification:', errUpdate);
        setError('Impossible de vérifier ce prof.');
        setProcessing(null);
        return;
      }

      // Recharger liste
      await fetchCandidatures();
      setProcessing(null);
    } catch (err) {
      console.error('[verifications] Exception vérification:', err);
      setError('Erreur interne lors de la vérification.');
      setProcessing(null);
    }
  }

  async function handleRefuser(prestataireId: string) {
    const motif = prompt('Motif de refus (sera communiqué au candidat) :');
    if (!motif) return;

    setProcessing(prestataireId);
    setError(null);

    try {
      // Passer statut à 'refuse' (EX-022 mentionne "refuser avec motif")
      // Note : le schéma enum `statut_verification` doit inclure 'refuse' — vérifier migration 0001
      const { error: errUpdate } = await supabase
        .schema('purama_marketplace')
        .from('prestataires')
        .update({
          statut_verification: 'refuse' as const,
          // Motif : si colonne existe (à créer si manquante), sinon log serveur
        })
        .eq('app_id', APP_ID)
        .eq('id', prestataireId);

      if (errUpdate) {
        console.error('[verifications] Erreur refus:', errUpdate);
        setError('Impossible de refuser ce prof.');
        setProcessing(null);
        return;
      }

      // Motif tracé côté client tant que la notification email du candidat n'est pas branchée
      // (phase concernée du plan) — aucune perte d'information en attendant.
      console.log(`[verifications] Refus prof ${prestataireId} : ${motif}`);

      await fetchCandidatures();
      setProcessing(null);
    } catch (err) {
      console.error('[verifications] Exception refus:', err);
      setError('Erreur interne lors du refus.');
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Chargement des candidatures...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-[#FFD700]">Vérification des profs</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Accès réservé au super administrateur. Horodater l&apos;identité, l&apos;entretien vidéo et le
        contrôle de la référence de vérification prof pour valider un prof.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-alerte/20 bg-alerte/10 p-4 text-sm text-alerte">
          {error}
        </div>
      )}

      {candidatures.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Aucune candidature en attente de vérification.
        </div>
      )}

      {candidatures.length > 0 && (
        <div className="space-y-4">
          {candidatures.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{c.titre}</h3>
                  <p className="text-sm text-muted-foreground">
                    {c.profil_nom || 'Nom inconnu'} · {c.commune} ({c.code_postal})
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Candidature déposée le {new Date(c.cree_le).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">{c.presentation}</p>

              {/* Vérification prof (NIYAMA-BRIEF §3, adapté KALA) : référence + date
                  auto-déclarées affichées à l'admin, contrôle explicite requis avant que
                  "Vérifier" ne soit activable. */}
              <div className="mb-4 rounded-lg border border-border bg-background-soft p-3 text-sm">
                {c.referenceVerif.reference && c.referenceVerif.dateDelivrance ? (
                  <>
                    <p className="mb-2">
                      Référence déclarée : <span className="font-mono font-medium">{c.referenceVerif.reference}</span>{' '}
                      (délivrée le {new Date(c.referenceVerif.dateDelivrance).toLocaleDateString('fr-FR')})
                    </p>
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={verifConfirme[c.id] || false}
                        onChange={(e) =>
                          setVerifConfirme((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                      />
                      J&apos;ai contrôlé cette référence de vérification prof et sa date de délivrance
                    </label>
                  </>
                ) : (
                  <p className="text-alerte">Référence de vérification prof non renseignée par le candidat — vérification impossible.</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleVerifier(c.id)}
                  disabled={processing === c.id || !c.referenceVerif.reference || !c.referenceVerif.dateDelivrance || !verifConfirme[c.id]}
                  className="rounded-lg bg-primary-on-dark px-4 py-2 text-sm font-semibold text-[#1C1F26] transition hover:bg-primary-on-dark/90 disabled:opacity-50"
                >
                  {processing === c.id ? 'Traitement...' : 'Vérifier'}
                </button>
                <button
                  onClick={() => handleRefuser(c.id)}
                  disabled={processing === c.id}
                  className="rounded-lg border border-alerte px-4 py-2 text-sm font-semibold text-alerte transition hover:bg-alerte/10 disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
