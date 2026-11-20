import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { APP_ID } from '@/lib/constants';
import { splitRevenue } from '@/lib/karma';
import { sendCoursTermineEmail } from '@/lib/resend';
import { createPayout, transferToProf } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase-server';

const reference = z.string().min(1).max(255);
const cents = z.number().int().nonnegative().max(2_147_483_647);
const envelope = z.object({
  id: reference,
  type: reference,
  livemode: z.boolean().optional(),
  account: reference.optional(),
  data: z.object({ object: z.unknown() }),
});
const payment = z.object({
  id: reference,
  amount: cents,
  amount_received: cents,
  currency: z.string(),
  livemode: z.boolean(),
  metadata: z.object({
    reservation_id: z.string().uuid(),
    app_id: z.string().optional(),
    user_id: z.string().uuid().optional(),
    prof_account_id: reference.optional(),
  }),
});
const plan = z.discriminatedUnion('action', [
  z.object({ action: z.literal('transfer'), account: reference, amount: cents.positive() }),
  z.object({
    action: z.literal('payout'),
    account: reference,
    amount: cents.positive(),
    method: z.enum(['instant', 'standard']),
  }),
  z.object({ action: z.literal('cashback'), fees: cents }),
  z.object({
    action: z.literal('email'),
    email: z.string().email(),
    name: z.string(),
    amount: cents.positive(),
  }),
  z.object({ action: z.literal('review'), reason: reference }),
  z.object({ action: z.literal('continue') }),
  z.object({ action: z.literal('busy') }),
  z.object({ action: z.literal('done') }),
]);
type Details = Record<string, string | number | boolean | null>;
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

async function rpc(db: RpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error('settlement_database_unavailable');
  return data;
}

async function settle(db: RpcClient, reservationId: string, live: boolean): Promise<string> {
  let owner = randomUUID();
  const advance = async (action: string, receipt?: string, amount?: number) =>
    plan.parse(
      await rpc(db, 'kala_avancer_reglement', {
        p_reservation: reservationId,
        p_action: action,
        p_titulaire: owner,
        p_reference: receipt ?? null,
        p_cents: amount ?? null,
      }),
    );
  for (let step = 0; step < 8; step++) {
    const work = await advance('next');
    if (work.action === 'done' || work.action === 'busy') return work.action;
    if (work.action === 'review') return work.reason;
    if (work.action === 'cashback') {
      // Existing course fee calculation, in cents. The course tariff is never split.
      const net = Math.max(work.fees - 35, 0) / 100;
      const credit = await advance('cashback', undefined, Math.round(splitRevenue(net).partUsers * 100));
      if (credit.action === 'review') return credit.reason;
      continue;
    }
    if (work.action === 'continue') throw new Error('unexpected_settlement_plan');
    let receipt: string;
    try {
      if (work.action === 'transfer') {
        const result = await transferToProf({
          reservationId,
          profAccountId: work.account,
          tarifCents: work.amount,
        });
        const destination =
          typeof result.destination === 'string' ? result.destination : result.destination?.id;
        if (
          !result.id ||
          result.livemode !== live ||
          result.amount !== work.amount ||
          result.currency !== 'eur' ||
          destination !== work.account ||
          result.transfer_group !== reservationId ||
          result.reversed ||
          result.amount_reversed !== 0
        )
          throw new Error('transfer_receipt_mismatch');
        receipt = result.id;
      } else if (work.action === 'payout') {
        let method = work.method;
        const result = await createPayout({
          reservationId,
          accountId: work.account,
          amountCents: work.amount,
          method,
          onStandardFallback: async () => {
            const decision = await advance('standard_allowed');
            if (decision.action !== 'continue') throw new Error('fallback_decision_unconfirmed');
            // A crash between these calls leaves a durable, unclaimed standard-only action.
            owner = randomUUID();
            const standard = await advance('next');
            if (
              standard.action !== 'payout' ||
              standard.method !== 'standard' ||
              standard.account !== work.account ||
              standard.amount !== work.amount
            ) {
              throw new Error('standard_action_unavailable');
            }
            method = 'standard';
          },
        });
        if (
          !result.id ||
          result.livemode !== live ||
          result.amount !== work.amount ||
          result.currency !== 'eur' ||
          result.method !== method ||
          !['pending', 'in_transit', 'paid'].includes(result.status)
        )
          throw new Error('payout_receipt_mismatch');
        receipt = result.id;
      } else {
        const id = await sendCoursTermineEmail(
          work.email,
          work.name,
          work.amount,
          `kala-cours-termine:${reservationId}`,
        );
        if (!id) throw new Error('email_receipt_missing');
        receipt = id;
      }
    } catch {
      // The request may already have reached the provider. Preserve the claim across deliveries.
      const uncertain = await advance('uncertain');
      return uncertain.action === 'review' ? uncertain.reason : 'settlement_pending';
    }
    // If this acknowledgement loses its response, a subsequent delivery reads its committed
    // checkpoint. An unconfirmed in-flight action remains held for reconciliation.
    const ack = await advance(`${work.action}_receipt`, receipt);
    if (ack.action === 'review') return ack.reason;
    if (ack.action !== 'continue' && ack.action !== 'done') return 'settlement_pending';
  }
  throw new Error('settlement_incomplete');
}

export async function POST(req: Request) {
  const signature = req.headers.get('X-Karma-Signature');
  const secret = process.env.KARMA_SHARED_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: 'Signature requise' }, { status: 401 });
  const raw = await req.text();
  const expected = createHmac('sha256', secret).update(raw).digest();
  if (!/^[a-f\d]{64}$/i.test(signature) || !timingSafeEqual(Buffer.from(signature, 'hex'), expected)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Événement invalide' }, { status: 400 });
  const event = parsed.data;
  const ignored = () => NextResponse.json({ success: true, eventId: event.id, skipped: true });
  if (event.type !== 'payment_intent.succeeded' && event.type !== 'reservation.terminee') return ignored();
  const keyMode = /^(?:sk|rk)_(test|live)_/.exec(process.env.STRIPE_SECRET_KEY ?? '')?.[1];
  if (!keyMode) return NextResponse.json({ error: 'Mode Stripe non vérifiable' }, { status: 503 });
  const live = keyMode === 'live';
  if (event.account) return ignored(); // KALA creates the charge on its platform account.
  if (event.livemode !== undefined && event.livemode !== live)
    return NextResponse.json({ error: 'Mode Stripe différent' }, { status: 409 });
  let details: Details;
  if (event.type === 'payment_intent.succeeded') {
    const target = z
      .object({
        metadata: z
          .object({ app_id: z.string().optional(), reservation_id: z.string().optional() })
          .nullish(),
      })
      .safeParse(event.data.object);
    if (
      target.success &&
      (!target.data.metadata?.reservation_id ||
        (target.data.metadata.app_id && target.data.metadata.app_id !== APP_ID))
    )
      return ignored();
    const result = payment.safeParse(event.data.object);
    if (!result.success) return NextResponse.json({ error: 'Paiement invalide' }, { status: 400 });
    const pi = result.data;
    if (event.livemode !== live || pi.livemode !== live)
      return NextResponse.json({ error: 'Mode de paiement non vérifiable' }, { status: 409 });
    details = {
      live,
      reservation_id: pi.metadata.reservation_id,
      intent: pi.id,
      amount: pi.amount,
      received: pi.amount_received,
      currency: pi.currency,
      app: pi.metadata.app_id ?? null,
      user: pi.metadata.user_id ?? null,
      account: pi.metadata.prof_account_id ?? null,
    };
  } else if (event.type === 'reservation.terminee') {
    const result = z
      .object({ id: z.string().uuid(), app_id: z.string().optional() })
      .safeParse(event.data.object);
    if (!result.success) return NextResponse.json({ error: 'Réservation invalide' }, { status: 400 });
    if (result.data.app_id && result.data.app_id !== APP_ID) return ignored();
    details = { live, reservation_id: result.data.id };
  } else return ignored();
  try {
    const db: RpcClient = createServiceClient();
    const receive = () =>
      rpc(db, 'kala_recevoir_evenement', { p_id: event.id, p_type: event.type, p_details: details });
    let status = await receive();
    if (status === 'processed') return ignored();
    if (status === 'settle') {
      status = await settle(db, String(details.reservation_id), live);
      if (status === 'done') status = await receive();
    }
    if (status === 'done' || status === 'processed')
      return NextResponse.json({ success: true, eventId: event.id });
    return NextResponse.json(
      {
        error: 'Règlement en attente',
        eventId: event.id,
        reason: typeof status === 'string' ? status : 'receipt_missing',
      },
      { status: 503 },
    );
  } catch {
    console.error('[stripe-event] Confirmation indisponible', event.id);
    return NextResponse.json({ error: 'Confirmation indisponible', eventId: event.id }, { status: 503 });
  }
}
