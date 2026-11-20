/**
 * stripe.ts — SDK Stripe SERVER-ONLY
 * Garde `import "server-only"` en tête pour bloquer tout import côté client.
 * JAMAIS importer ce fichier dans un composant 'use client'.
 */

import 'server-only';
import Stripe from 'stripe';
import { CURRENCY } from './stripe-plans';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- utilisé par stripe-plans indirectement
import { PCT_FRAIS_SERVICE, APP_ID } from './constants';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY manquant dans .env.local');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Omettre apiVersion (utilise la version du compte Stripe, cf PIEGES §1)
  appInfo: {
    name: 'KALA',
    url: 'https://kala.purama.dev',
  },
});

/**
 * Crée un PaymentIntent pour une réservation, avec séquestre (separate charges and transfers).
 * Le montant total (tarif + frais) est encaissé sur le compte plateforme,
 * puis un Transfer est créé au passage `terminee` vers le compte Connect du prof.
 */
export async function createReservationCheckout(params: {
  tarifCents: number;
  fraisServiceCents: number;
  profAccountId: string; // Stripe Connect account_id
  reservationId: string;
  userId: string;
}): Promise<Stripe.PaymentIntent> {
  const totalCents = params.tarifCents + params.fraisServiceCents;

  const intent = await stripe.paymentIntents.create(
    {
      amount: totalCents,
      currency: CURRENCY,
      metadata: {
        app_id: APP_ID,
        reservation_id: params.reservationId,
        user_id: params.userId,
        tarif_cents: params.tarifCents.toString(),
        frais_service_cents: params.fraisServiceCents.toString(),
        prof_account_id: params.profAccountId,
      },
      transfer_group: params.reservationId, // lie le Transfer à venir
    },
    { idempotencyKey: `reservation-checkout:${params.reservationId}` }
  );

  return intent;
}

/**
 * Déclenche le Transfer du tarif du prof depuis le compte plateforme vers le compte Connect.
 * Appelé au passage de la réservation en statut `terminee`.
 */
export async function transferToProf(params: {
  tarifCents: number;
  profAccountId: string;
  reservationId: string;
}): Promise<Stripe.Transfer> {
  const transfer = await stripe.transfers.create(
    {
      amount: params.tarifCents,
      currency: CURRENCY,
      destination: params.profAccountId,
      transfer_group: params.reservationId,
      metadata: {
        app_id: APP_ID,
        reservation_id: params.reservationId,
      },
    },
    { idempotencyKey: `reservation-transfer:${params.reservationId}` }
  );

  return transfer;
}

const definitiveInstantPayoutRefusals = new Set([
  'instant_payouts_unsupported',
  'instant_payouts_config_disabled',
  'instant_payouts_limit_exceeded',
]);

/** Reprend le mode enregistré pour la réservation et conserve sa clé Stripe. */
export async function createPayout(params: {
  amountCents: number;
  accountId: string;
  reservationId: string;
  method?: 'instant' | 'standard';
  onStandardFallback?: () => Promise<void>;
}): Promise<Stripe.Payout> {
  const create = (method: 'instant' | 'standard') => stripe.payouts.create(
    {
      amount: params.amountCents,
      currency: CURRENCY,
      method,
      metadata: {
        app_id: APP_ID,
        reservation_id: params.reservationId,
      },
    },
    {
      stripeAccount: params.accountId,
      idempotencyKey: `${APP_ID}:payout:${params.reservationId}:${method}`,
    }
  );

  if (params.method === 'standard') return create('standard');
  try {
    return await create('instant');
  } catch (error) {
    // Une réponse perdue peut correspondre à un versement déjà créé.
    const rejection = error instanceof Stripe.errors.StripeInvalidRequestError
      || error instanceof Stripe.errors.StripePermissionError
      || error instanceof Stripe.errors.StripeCardError;
    if (!rejection || !error.statusCode || ![400, 402, 403, 422].includes(error.statusCode)
      || !definitiveInstantPayoutRefusals.has(error.code ?? '')) {
      throw error;
    }
    await params.onStandardFallback?.();
    return create('standard');
  }
}

/**
 * Génère un AccountSession Stripe Connect pour Embedded Components (onboarding prof).
 */
export async function createAccountSession(accountId: string): Promise<Stripe.AccountSession> {
  const session = await stripe.accountSessions.create({
    account: accountId,
    components: {
      account_onboarding: { enabled: true },
      payment_details: { enabled: true },
      payouts: { enabled: true },
    },
  });

  return session;
}
