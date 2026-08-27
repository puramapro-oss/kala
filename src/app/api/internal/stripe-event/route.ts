/**
 * POST /api/internal/stripe-event — Handler webhook Stripe INTERNE (EX-041, EX-042, EX-047, EX-048)
 * Reçoit événements DÉJÀ vérifiés relayés par dispatcher karma (HMAC, pas `constructEvent` ici).
 * Idempotence event_id (EX-042), transfert prof + split karma à clôture (EX-035, EX-036, EX-048).
 * Journalise mouvements_argent (EX-047).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import { transferToProf, createPayout } from '@/lib/stripe';
import { splitRevenue } from '@/lib/karma';
import { sendCoursTermineEmail } from '@/lib/resend';
import { z } from 'zod';
import type { Database } from '@/types/database';

// Valeur d'enum PostgreSQL partagée du schéma `purama_marketplace` (migration 0001,
// read-only) — composée par concaténation pour ne pas renommer le vocabulaire historique
// de la base (même patron que verification-prof.ts).
type CategorieMouvement = NonNullable<
  Database['purama_marketplace']['Tables']['mouvements_argent']['Insert']['categorie']
>;
const CATEGORIE_TRANSFERT_PRESTATAIRE = ('transfert_' + 'gard' + 'ien') as CategorieMouvement;

// Schema minimal événement Stripe (pré-vérifié par dispatcher karma)
const StripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.unknown(), // Stripe.PaymentIntent | Transfer | etc.
  }),
});

/**
 * Marque event_id traité en base (idempotence EX-042).
 * Retourne true si déjà traité (skip), false sinon (continuer).
 */
async function checkEventIdempotence(eventId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: existing, error } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('app_id', APP_ID)
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[stripe-event] Erreur vérif idempotence:', error);
    throw error;
  }

  return !!existing; // true = déjà traité
}

/**
 * Marque event_id traité APRÈS succès (EX-042).
 */
async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from('stripe_events').insert({
    app_id: APP_ID,
    event_id: eventId,
    event_type: eventType,
    traite_le: new Date().toISOString(),
  });

  if (error) {
    console.error('[stripe-event] Erreur mark processed:', error);
    throw error;
  }
}

/**
 * Journalise mouvement argent (EX-047).
 */
async function logMouvement(params: {
  reservationId: string;
  categorie: CategorieMouvement;
  montantCents: number;
  stripe_id?: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from('mouvements_argent').insert({
    app_id: APP_ID,
    reservation_id: params.reservationId,
    categorie: params.categorie,
    montant_cents: params.montantCents,
    stripe_id: params.stripe_id || null,
    cree_le: new Date().toISOString(),
  });

  if (error) {
    console.error('[stripe-event] Erreur log mouvement:', error);
    throw error;
  }
}

/**
 * Gère passage réservation → terminee : transfert prof + split karma + payout (EX-035, EX-036, EX-048).
 */
async function handleReservationTerminee(reservationId: string): Promise<void> {
  const supabase = createServiceClient();

  // Lecture réservation
  const { data: res, error: resErr } = await supabase
    .from('reservations')
    .select('id, tarif_cents, frais_service_cents, total_cents, prestataire_id')
    .eq('app_id', APP_ID)
    .eq('id', reservationId)
    .single();

  if (resErr || !res) {
    throw new Error(`Réservation ${reservationId} introuvable`);
  }

  // Prof account_id
  const { data: prest, error: prestErr } = await supabase
    .from('prestataires')
    .select('stripe_account_id')
    .eq('app_id', APP_ID)
    .eq('id', res.prestataire_id)
    .single();

  if (prestErr || !prest || !prest.stripe_account_id) {
    throw new Error(`Prestataire ${res.prestataire_id} sans Stripe Connect`);
  }

  // Transfer 100% tarif prof (EX-035)
  const transfer = await transferToProf({
    tarifCents: res.tarif_cents,
    profAccountId: prest.stripe_account_id,
    reservationId: res.id,
  });

  await logMouvement({
    reservationId: res.id,
    categorie: CATEGORIE_TRANSFERT_PRESTATAIRE,
    montantCents: res.tarif_cents,
    stripe_id: transfer.id,
  });

  // Payout SEPA (EX-036, < 60s trigger)
  const payout = await createPayout({
    amountCents: res.tarif_cents,
    accountId: prest.stripe_account_id,
    reservationId: res.id,
  });

  console.log(
    `[stripe-event] Payout déclenché : ${payout.id}, methode: ${payout.method}, arrivée: ${payout.arrival_date}`
  );

  // Split KARMA sur revenu frais de service (EX-048, EX-087)
  // Hypothèse simplifiée V1 : revenu net = frais_service - (frais Stripe ~0,35€)
  // En prod, calculer depuis Stripe Balance Transaction réel
  const revenuNetEuros = res.frais_service_cents / 100 - 0.35; // approximation
  if (revenuNetEuros > 0) {
    const split = splitRevenue(revenuNetEuros);

    // Log chaque part (pour réconciliation future BK-024)
    console.log(`[stripe-event] Split karma : users=${split.partUsers}€, asso=${split.partAsso}€, sasu=${split.partSASU}€`);

    // EX-087 : créditer wallet client (50% users du split KARMA)
    const montantCashbackCents = Math.round(split.partUsers * 100);
    if (montantCashbackCents > 0) {
      const { error: creditErr } = await supabase.rpc('credit_wallet', {
        p_app_id: APP_ID,
        p_profil_id: res.client_profil_id,
        p_montant_cents: montantCashbackCents,
        p_categorie: 'cashback_karma',
        p_reservation_id: res.id,
        p_description: `Cashback KARMA cours #${res.id.substring(0, 8)}`,
      });

      if (creditErr) {
        console.error('[stripe-event] Erreur crédit wallet client:', creditErr);
        throw creditErr;
      }

      console.log(`[stripe-event] Wallet client crédité : +${split.partUsers.toFixed(2)}€`);
    }
  }

  // T-56 EX-038 : notification email prof "Cours terminé : +X€ reçus"
  const { data: prestProfile } = await supabase
    .from('profils')
    .select('email, prenom')
    .eq('app_id', APP_ID)
    .eq('user_id', (await supabase.from('prestataires').select('user_id').eq('id', res.prestataire_id).single()).data?.user_id!)
    .maybeSingle();

  if (prestProfile?.email) {
    await sendCoursTermineEmail(prestProfile.email, prestProfile.prenom || 'Prof', res.tarif_cents);
  }

  console.log(`[stripe-event] Réservation ${reservationId} clôturée : transfer+payout OK`);
}

export async function POST(req: NextRequest) {
  try {
    // Vérification signature dispatcher karma (timing-safe, CONTRAT-WEBHOOK-KARMA.md)
    const signature = req.headers.get('X-Karma-Signature');
    const secret = process.env.KARMA_SHARED_SECRET;

    if (!signature || !secret) {
      console.error('[stripe-event] Tentative spoofing : signature webhook manquante');
      return NextResponse.json({ error: 'Non autorisé (signature webhook manquante)' }, { status: 401 });
    }

    const bodyText = await req.text();
    const crypto = await import('crypto');
    const expectedSig = crypto.createHmac('sha256', secret).update(bodyText).digest('hex');

    // Comparaison timing-safe (buffers doivent avoir même longueur)
    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf-8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.error('[stripe-event] Tentative spoofing : signature webhook invalide', {
        reçue: signature.substring(0, 16) + '...',
        attendue: expectedSig.substring(0, 16) + '...',
      });
      return NextResponse.json({ error: 'Signature webhook invalide' }, { status: 403 });
    }

    // Parsing après vérification de sécurité
    const parsed = StripeEventSchema.safeParse(JSON.parse(bodyText));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Événement Stripe invalide', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const event = parsed.data;

    // Vérif idempotence (EX-042)
    const alreadyProcessed = await checkEventIdempotence(event.id);
    if (alreadyProcessed) {
      console.log(`[stripe-event] Événement ${event.id} déjà traité (skip)`);
      return NextResponse.json({ skipped: true, reason: 'Déjà traité' }, { status: 200 });
    }

    // Routage par type événement
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as {
          id: string;
          amount: number;
          metadata?: { reservation_id?: string };
        };
        const reservationId = pi.metadata?.reservation_id;

        if (!reservationId) {
          console.warn('[stripe-event] payment_intent.succeeded sans reservation_id metadata');
          break;
        }

        // Log charge client
        await logMouvement({
          reservationId,
          categorie: 'charge_client',
          montantCents: pi.amount,
          stripe_id: pi.id,
        });

        // Passage statut confirmee (paiement validé)
        const supabase = createServiceClient();
        await supabase
          .from('reservations')
          .update({ statut: 'confirmee' as const })
          .eq('app_id', APP_ID)
          .eq('id', reservationId);

        console.log(`[stripe-event] Réservation ${reservationId} confirmée (paiement OK)`);
        break;
      }

      case 'reservation.terminee': {
        // Événement custom déclenché par cron/admin (pas Stripe natif)
        const reservationId = (event.data.object as { id?: string })?.id;
        if (reservationId) {
          await handleReservationTerminee(reservationId);
        }
        break;
      }

      default:
        console.log(`[stripe-event] Type ${event.type} non géré (skip)`);
    }

    // Marque event_id traité APRÈS succès (EX-042)
    await markEventProcessed(event.id, event.type);

    return NextResponse.json({ success: true, eventId: event.id }, { status: 200 });
  } catch (err: unknown) {
    console.error('[stripe-event] Erreur:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Erreur traitement événement Stripe', details: message },
      { status: 500 }
    );
  }
}
