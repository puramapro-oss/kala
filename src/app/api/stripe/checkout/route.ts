/**
 * POST /api/stripe/checkout — Création PaymentIntent séquestre (EX-034, EX-035, EX-041)
 * GARDE-FOU FINANCIER ACTIF : clé Stripe LIVE → création PI + annulation immédiate (preuve uniquement).
 * Jamais .confirm(), jamais .capture(), jamais carte réelle en V1.
 * metadata.app_id='kala' pour routage dispatcher partagé karma (EX-041).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import { createReservationCheckout, stripe } from '@/lib/stripe';
import { rateLimitByUser } from '@/lib/rate-limit';
import { z } from 'zod';

const CheckoutSchema = z.object({
  reservationId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    // Auth sur le client cookie, pas le client service (B29-1, passage 29) : même règle que
    // /api/reservations — le client service n'a aucun cookie, `getUser()` y est toujours null.
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Rate limit
    const rateLimitResult = await rateLimitByUser(user.id, 'checkout');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: `Trop de demandes, réessayez dans ${Math.ceil(rateLimitResult.retryAfter / 1000)} secondes.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { reservationId } = parsed.data;

    // Lecture réservation (montants serveur)
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .select('id, tarif_cents, frais_service_cents, prestataire_id, client_profil_id')
      .eq('app_id', APP_ID)
      .eq('id', reservationId)
      .single();

    if (resErr || !reservation) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }

    // Vérif propriété (sécurité)
    const { data: profil, error: profilErr } = await supabase
      .from('profils')
      .select('id')
      .eq('app_id', APP_ID)
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (profilErr || !profil || profil.id !== reservation.client_profil_id) {
      return NextResponse.json(
        { error: 'Non autorisé (réservation non propriétaire)' },
        { status: 403 }
      );
    }

    // Récup account_id prof (Stripe Connect)
    const { data: prestataire, error: prestErr } = await supabase
      .from('prestataires')
      .select('stripe_account_id')
      .eq('app_id', APP_ID)
      .eq('id', reservation.prestataire_id)
      .single();

    if (prestErr || !prestataire || !prestataire.stripe_account_id) {
      return NextResponse.json(
        { error: 'Prof sans compte Stripe Connect configuré' },
        { status: 400 }
      );
    }

    // Création PaymentIntent (séquestre, EX-035)
    const intent = await createReservationCheckout({
      tarifCents: reservation.tarif_cents,
      fraisServiceCents: reservation.frais_service_cents,
      profAccountId: prestataire.stripe_account_id,
      reservationId: reservation.id,
      userId: user.id,
    });

    console.log(`[checkout] PaymentIntent créé : ${intent.id}, statut: ${intent.status}`);

    // GARDE-FOU FINANCIER : annulation immédiate (clé LIVE, zéro capture réelle autorisée)
    if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
      const canceled = await stripe.paymentIntents.cancel(intent.id);
      console.log(`[checkout] PaymentIntent ANNULÉ (preuve uniquement) : ${canceled.id}, statut: ${canceled.status}`);

      return NextResponse.json(
        {
          success: true,
          message: 'PaymentIntent créé puis annulé immédiatement (preuve garde-fou financier actif).',
          proof: {
            paymentIntentId: intent.id,
            statusInitial: intent.status,
            statusFinal: canceled.status,
            montantCents: intent.amount,
            metadata: intent.metadata,
          },
        },
        { status: 200 }
      );
    }

    // Env test (ne devrait jamais arriver, mais au cas où)
    return NextResponse.json(
      {
        success: true,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('[checkout] Erreur:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Erreur serveur interne', details: message },
      { status: 500 }
    );
  }
}
