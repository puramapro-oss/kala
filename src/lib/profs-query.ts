/**
 * Requête partagée pour la liste des profs vérifiés — extraite de /api/profs (B23-6) pour
 * être appelée aussi côté serveur par `src/app/page.tsx` (premier rendu SSR), sans dupliquer la
 * logique Haversine/filtrage/tri.
 * EX-009 : anon ne touche JAMAIS PostgREST direct, cette fonction injecte app_id.
 * EX-005 : distance calculée par Haversine côté serveur.
 * EX-018 : seuls statut_verification='verifie' exposés.
 */

import { createServiceClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import type { Database } from '@/types/database';

export interface Coords {
  lat: number;
  lon: number;
}

export interface ProfPublic {
  id: string;
  photo_url: string | null;
  prenom: string;
  note_moyenne: number | null;
  distance_km: number;
  tarif_minimum_cents: number | null;
  types_garde: string[];
  commune: string;
  karma_score: number;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // rayon Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getProfsPublics(coords: Coords, rayon = 25, limit = 5): Promise<ProfPublic[]> {
  const supabase = createServiceClient<Database, 'purama_marketplace'>();

  const { data: prestataires, error: errPrestataires } = await supabase
    .schema('purama_marketplace')
    .from('prestataires')
    .select('id, profil_id, titre, commune, latitude, longitude, karma_score, note_moyenne, nb_avis, est_demo')
    .eq('app_id', APP_ID)
    .eq('statut_verification', 'verifie')
    .eq('badge_verifie', true);

  if (errPrestataires) {
    console.error('[getProfsPublics] Erreur fetch prestataires:', errPrestataires);
    throw new Error('Impossible de récupérer les profs.');
  }
  if (!prestataires || prestataires.length === 0) {
    // EX-004 : état vide honnête (aucun prof fictif) — distinct d'une erreur DB.
    return [];
  }

  type PrestataireRow = Database['purama_marketplace']['Tables']['prestataires']['Row'];
  const profilIds = prestataires.map((p: PrestataireRow) => p.profil_id);
  const { data: profils, error: errProfils } = await supabase
    .schema('purama_marketplace')
    .from('profils')
    .select('id, affichage_nom, avatar_url')
    .eq('app_id', APP_ID)
    .in('id', profilIds);

  if (errProfils || !profils) {
    console.error('[getProfsPublics] Erreur fetch profils:', errProfils);
    throw new Error('Impossible de récupérer les profils.');
  }

  const prestataireIds = prestataires.map((p: PrestataireRow) => p.id);
  const { data: prestations, error: errPrestations } = await supabase
    .schema('purama_marketplace')
    .from('prestations')
    .select('prestataire_id, type_garde, prix_cents')
    .eq('app_id', APP_ID)
    .in('prestataire_id', prestataireIds)
    .eq('actif', true);

  if (errPrestations || !prestations) {
    console.error('[getProfsPublics] Erreur fetch prestations:', errPrestations);
    throw new Error('Impossible de récupérer les prestations.');
  }

  type ProfilRow = Database['purama_marketplace']['Tables']['profils']['Row'];
  type PrestationRow = Database['purama_marketplace']['Tables']['prestations']['Row'];

  const profilMap = new Map<string, ProfilRow>();
  profils.forEach((p: ProfilRow) => profilMap.set(p.id, p));

  const prestationsMap = new Map<string, PrestationRow[]>();
  prestations.forEach((prest: PrestationRow) => {
    const existing = prestationsMap.get(prest.prestataire_id) || [];
    existing.push(prest);
    prestationsMap.set(prest.prestataire_id, existing);
  });

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_SEED === '1';

  const profsEnrichis = prestataires
    .map((p: PrestataireRow) => {
      const profil = profilMap.get(p.profil_id);
      const prests = prestationsMap.get(p.id) || [];

      if (p.est_demo && !isDemoMode) return null;

      const distance = haversine(coords.lat, coords.lon, p.latitude, p.longitude);
      if (distance > rayon) return null;

      const tarifMin = prests.length > 0 ? Math.min(...prests.map((pr: PrestationRow) => pr.prix_cents)) : null;
      const typesGarde = [...new Set(prests.map((pr: PrestationRow) => pr.type_garde))];

      return {
        id: p.id,
        photo_url: profil?.avatar_url || null,
        prenom: profil?.affichage_nom || 'Prof',
        note_moyenne: p.note_moyenne ? parseFloat(String(p.note_moyenne)) : null,
        distance_km: Math.round(distance * 10) / 10,
        tarif_minimum_cents: tarifMin,
        types_garde: typesGarde,
        commune: p.commune,
        karma_score: p.karma_score,
        _distance: distance,
      };
    })
    .filter((g: (ProfPublic & { _distance: number }) | null): g is ProfPublic & { _distance: number } => g !== null);

  profsEnrichis.sort((a: ProfPublic & { _distance: number }, b: ProfPublic & { _distance: number }) => a._distance - b._distance);
  return profsEnrichis.slice(0, limit).map(({ _distance, ...rest }: ProfPublic & { _distance: number }) => rest);
}
