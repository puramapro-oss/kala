/**
 * POST /api/reservations — Création d'une réservation (EX-028, EX-034, EX-045, EX-046, EX-049)
 * - Vérifie non-chevauchement prof (EX-045)
 * - Calcule montants serveur, jamais client (EX-034)
 * - Force récurrence='aucune' V1 (EX-046)
 * - Rate limit par user_id (EX-049)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import { calculerPricing } from '@/lib/pricing-kala';
import { rateLimitByUser } from '@/lib/rate-limit';
import { z } from 'zod';
import type { Database } from '@/types/database';

type TypeGarde = Database['purama_marketplace']['Enums']['type_garde'];
type Recurrence = Database['purama_marketplace']['Enums']['recurrence'];

// KALA : cours à domicile ('domicile') ou chez le prof ('visite') — 'promenade' n'existe pas ici
const CreateReservationSchema = z.object({
  prestataireId: z.string().uuid(),
  typeGarde: z.enum(['domicile', 'visite'] as const),
  debutLe: z.string().datetime(),
  finLe: z.string().datetime(),
  tarifCents: z.number().int().positive(),
}).refine(({ debutLe, finLe }) => Date.parse(finLe) > Date.parse(debutLe), {
  path: ['finLe'],
  message: 'La fin du cours doit être postérieure à son début.',
});

export async function POST(req: NextRequest) {
  try {
    // Auth sur le client cookie, pas le client service (B29-1, passage 29) : le client service n'a
    // aucun cookie par construction, son `getUser()` renvoie toujours null — cette route renvoyait
    // 401 à TOUT utilisateur connecté (aucune réservation n'a jamais pu être créée).
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Rate limit (EX-049)
    const rateLimitResult = await rateLimitByUser(user.id, 'create_reservation');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: `Trop de demandes, réessayez dans ${Math.ceil(rateLimitResult.retryAfter / 1000)} secondes.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { prestataireId, typeGarde, debutLe, finLe, tarifCents } = parsed.data;
    const supabase = createServiceClient();

    const { data: profil, error: profilErr } = await supabase
      .from('profils')
      .select('id')
      .eq('app_id', APP_ID)
      .eq('user_id', user.id)
      .maybeSingle();

    if (profilErr) {
      console.error('[reservations] Erreur lecture profil:', profilErr);
      return NextResponse.json({ error: 'Erreur vérification du profil client' }, { status: 500 });
    }
    if (!profil) {
      return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 });
    }

    // Le client service contourne RLS : vérifier explicitement le tenant et la
    // publication du prof, comme sur la page publique de réservation.
    const { data: prof, error: profErr } = await supabase
      .from('prestataires')
      .select('id')
      .eq('app_id', APP_ID)
      .eq('id', prestataireId)
      .eq('statut_verification', 'verifie')
      .maybeSingle();

    if (profErr) {
      console.error('[reservations] Erreur lecture prof:', profErr);
      return NextResponse.json({ error: 'Erreur vérification du prof' }, { status: 500 });
    }
    if (!prof) {
      return NextResponse.json({ error: 'Prof vérifié introuvable' }, { status: 404 });
    }

    const { data: prestation, error: prestationErr } = await supabase
      .from('prestations')
      .select('prix_cents')
      .eq('app_id', APP_ID)
      .eq('prestataire_id', prestataireId)
      .eq('type_garde', typeGarde)
      .eq('actif', true)
      .maybeSingle();

    if (prestationErr) {
      console.error('[reservations] Erreur lecture prestation:', prestationErr);
      return NextResponse.json({ error: 'Erreur vérification du tarif du cours' }, { status: 500 });
    }
    if (!prestation) {
      return NextResponse.json({ error: 'Ce type de cours n’est plus disponible.' }, { status: 409 });
    }
    if (!Number.isSafeInteger(prestation.prix_cents) || prestation.prix_cents <= 0) {
      return NextResponse.json({ error: 'Tarif du cours invalide' }, { status: 500 });
    }
    // Le tarif transmis sert à détecter un affichage périmé, jamais à fixer le
    // prix. Refuser un écart évite aussi de réserver silencieusement plus cher.
    if (prestation.prix_cents !== tarifCents) {
      return NextResponse.json(
        { error: 'Le tarif de ce cours a changé. Actualisez la page avant de réserver.' },
        { status: 409 }
      );
    }

    // Recalcul montants serveur (EX-034)
    const pricing = calculerPricing(prestation.prix_cents);

    // Intervalles [début, fin), comme tstzrange dans la contrainte EXCLUDE
    // de 0003 : les deux conditions sont nécessaires et deux cours contigus
    // ne se chevauchent pas. La contrainte DB protège la confirmation concurrente.
    const { data: conflits, error: conflitErr } = await supabase
      .from('reservations')
      .select('id')
      .eq('app_id', APP_ID)
      .eq('prestataire_id', prestataireId)
      .in('statut', ['confirmee', 'en_cours'] as const)
      .lt('debut_le', finLe)
      .gt('fin_le', debutLe)
      .limit(1);

    if (conflitErr) {
      console.error('[reservations] Erreur vérif conflit:', conflitErr);
      return NextResponse.json(
        { error: 'Erreur vérification disponibilité prof' },
        { status: 500 }
      );
    }

    if (conflits && conflits.length > 0) {
      return NextResponse.json(
        { error: 'Le prof a déjà une réservation confirmée sur ce créneau.' },
        { status: 409 }
      );
    }

    // INSERT reservation (EX-046 : recurrence forcée 'aucune')
    // total_client_cents GENERATED, ne PAS inclure dans INSERT
    const { data: newRes, error: insertErr } = await supabase
      .from('reservations')
      .insert({
        app_id: APP_ID,
        client_profil_id: profil.id,
        prestataire_id: prestataireId,
        type_garde: typeGarde as TypeGarde,
        debut_le: debutLe,
        fin_le: finLe,
        recurrence: 'aucune' as Recurrence,
        tarif_cents: pricing.tarifCents,
        frais_service_cents: pricing.fraisServiceCents,
        statut: 'en_attente_paiement' as const,
      })
      .select()
      .single();

    if (insertErr?.code === '23P01') {
      return NextResponse.json(
        { error: 'Le prof a déjà une réservation confirmée sur ce créneau.' },
        { status: 409 }
      );
    }
    if (insertErr || !newRes) {
      console.error('[reservations] Erreur INSERT:', insertErr);
      return NextResponse.json({ error: 'Échec création réservation' }, { status: 500 });
    }

    return NextResponse.json({ reservation: newRes }, { status: 201 });
  } catch (err: unknown) {
    console.error('[reservations] Erreur inattendue:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Erreur serveur interne', details: message },
      { status: 500 }
    );
  }
}
