import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';
import { APP_ID } from '@/lib/constants';

// EX-049 : rate limit module-level (Node.js runtime, PIEGES §12)
// V1 simple : 10 requêtes/minute/user. Post-lancement : migrer vers Upstash Redis.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Zod schéma — KALA : entrées photo et note uniquement (pas de suivi GPS de promenade)
const EntreeTimelineSchema = z.object({
  reservation_id: z.string().uuid(),
  typeEntree: z.enum(['photo', 'note']),
  contenuTexte: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

// B30-17/B30-3 (passage 30) : le nom du prof (`profils`) appartient à un AUTRE utilisateur que
// celui qui consulte la timeline — la policy RLS `profils` ne laisse un client lire que SA
// PROPRE ligne (mesuré : la requête directe côté navigateur ne renvoyait que le profil de
// l'appelant, jamais celui du prof). Ce GET, vérifié service_role après un contrôle
// d'appartenance identique à celui de timeline/page.tsx, donne un accès en lecture seule et
// scopé à CETTE réservation, sans élargir la policy RLS elle-même.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsedId = z.string().uuid().safeParse(searchParams.get('reservation_id'));

    if (!parsedId.success) {
      return NextResponse.json({ error: 'reservation_id invalide' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Budget distinct de POST (clé préfixée) : consulter la timeline ne doit pas épuiser le quota
    // d'écriture du prof.
    if (!checkRateLimit(`get:${user.id}`, 30, 60000)) {
      return NextResponse.json(
        { error: 'Trop de requêtes, veuillez patienter' },
        { status: 429 }
      );
    }

    const { data: profil } = await supabase
      .from('profils')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profil) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    const { data: resa, error: resaError } = await supabase
      .from('reservations')
      .select(`
        id,
        client_profil_id,
        prestataires:prestataire_id (
          profil_id
        )
      `)
      .eq('id', parsedId.data)
      .single();

    if (resaError || !resa) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }

    const resaTyped = resa as {
      id: string;
      client_profil_id: string;
      prestataires?: { profil_id: string };
    };
    const profProfilId = resaTyped.prestataires?.profil_id;

    // EX-057 : seul l'élève ou le prof de CETTE réservation peut lire ce contexte — même
    // règle que timeline/page.tsx.
    if (profil.id !== profProfilId && profil.id !== resaTyped.client_profil_id) {
      return NextResponse.json({ error: 'Vous n\'avez pas accès à cette timeline' }, { status: 403 });
    }

    let profNom: string | null = null;
    if (profProfilId) {
      const { data: profilProf } = await supabase
        .from('profils')
        .select('affichage_nom')
        .eq('id', profProfilId)
        .single();
      profNom = profilProf?.affichage_nom ?? null;
    }

    return NextResponse.json({ profNom });
  } catch (error: unknown) {
    console.error('GET /api/enregistrements error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Auth sur le client cookie, pas le client service (B29-1, passage 29) : même règle que
    // /api/reservations — le client service n'a aucun cookie, `getUser()` y est toujours null.
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Rate limit (EX-049 : clé dérivée user_id serveur, 10 req/min)
    if (!checkRateLimit(user.id, 10, 60000)) {
      return NextResponse.json(
        { error: 'Trop de requêtes, veuillez patienter' },
        { status: 429 }
      );
    }

    // Parse body
    const body = await req.json();
    const parsed = EntreeTimelineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { reservation_id, typeEntree, contenuTexte, photoUrl } = parsed.data;

    // Récupérer profil de l'utilisateur
    const { data: profil } = await supabase
      .from('profils')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profil) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    // Vérifier que l'utilisateur est bien le prof de cette réservation
    const { data: resa, error: resaError } = await supabase
      .from('reservations')
      .select(`
        id,
        statut,
        debut_le,
        fin_le,
        prestataires:prestataire_id (
          profil_id
        )
      `)
      .eq('id', reservation_id)
      .single();

    if (resaError || !resa) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }

    const resaTyped = resa as {
      id: string;
      statut: string;
      debut_le: string;
      fin_le: string;
      prestataires?: { profil_id: string };
    };

    const profProfilId = resaTyped.prestataires?.profil_id;

    if (profil.id !== profProfilId) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas le prof de cette réservation' },
        { status: 403 }
      );
    }

    // EX-051 : accessible uniquement si statut en_cours
    if (resaTyped.statut !== 'en_cours') {
      return NextResponse.json(
        { error: 'La timeline n\'est accessible que pendant le cours' },
        { status: 400 }
      );
    }

    // B4/schéma réel vs colonnes fantômes (passage 29) : purama_marketplace.journal_garde n'a
    // pas de coords_gps_debut/fin (jamais existé en base), pas de trace_gps/distance_km/
    // duree_minutes/horodatage (colonnes réelles : trace_points, distance_m, duree_s, survenu_le).
    // KALA : photo et note uniquement — les colonnes GPS (trace_points, distance_m, duree_s)
    // restent null, elles ne sont plus alimentées par cette app.
    // EX-059 : survenu_le en ISO (serveur UTC, affichage en local côté client)
    const survenu_le = new Date().toISOString();

    // EX-078 : app_id injecté serveur
    const { data: inserted, error: insertError } = await supabase
      .from('journal_garde')
      .insert({
        app_id: APP_ID,
        reservation_id,
        auteur_profil_id: profil.id,
        type: typeEntree,
        message: contenuTexte || null,
        photo_path: photoUrl || null,
        trace_points: null,
        trace_interrompue: false,
        distance_m: null,
        duree_s: null,
        survenu_le,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erreur INSERT journal_garde:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, entry: inserted });
  } catch (error: unknown) {
    console.error('POST /api/enregistrements error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
