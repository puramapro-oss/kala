import Stripe from 'stripe';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const input = { amountCents: 1250, accountId: 'acct_local', reservationId: 'reservation-123' };
const paid = { id: 'po_local' } as Stripe.Response<Stripe.Payout>;
let payments: typeof import('./stripe');

beforeAll(async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_kala_unit_fixture');
  payments = await import('./stripe');
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllEnvs());

function unsupported(code = 'instant_payouts_unsupported') {
  return new Stripe.errors.StripeInvalidRequestError({ code, statusCode: 400, message: code });
}

describe('reprise du versement par réservation', () => {
  it('réutilise la même clé et le compte du prestataire pour deux essais instantanés', async () => {
    const send = vi.spyOn(payments.stripe.payouts, 'create').mockResolvedValue(paid);
    await payments.createPayout(input);
    await payments.createPayout(input);
    for (const [body, options] of send.mock.calls) {
      expect(body).toMatchObject({ amount: 1250, currency: 'eur', method: 'instant' });
      expect(options).toEqual({
        stripeAccount: input.accountId, idempotencyKey: 'kala:payout:reservation-123:instant',
      });
    }
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each(['instant_payouts_unsupported', 'instant_payouts_config_disabled', 'instant_payouts_limit_exceeded'])(
    'enregistre le passage au standard après un refus définitif %s', async code => {
      const order: string[] = [];
      const send = vi.spyOn(payments.stripe.payouts, 'create')
        .mockImplementationOnce(async () => { order.push('instant'); throw unsupported(code); })
        .mockImplementationOnce(async () => { order.push('standard'); return paid; });
      await payments.createPayout({ ...input, onStandardFallback: async () => { order.push('mémorisé'); } });
      expect(order).toEqual(['instant', 'mémorisé', 'standard']);
      expect(send.mock.calls[1]).toEqual([
        expect.objectContaining({ method: 'standard', amount: input.amountCents }),
        { stripeAccount: input.accountId, idempotencyKey: 'kala:payout:reservation-123:standard' },
      ]);
    },
  );

  it.each([
    new Stripe.errors.StripeConnectionError({ message: 'réponse perdue' }),
    new Stripe.errors.StripeAPIError({ statusCode: 500, message: 'erreur serveur' }),
    new Stripe.errors.StripeRateLimitError({ statusCode: 429, message: 'réessayer' }),
    new Stripe.errors.StripeInvalidRequestError({
      statusCode: 409, code: 'instant_payouts_unsupported', message: 'requête déjà en cours',
    }),
    unsupported('balance_insufficient'),
  ])('remonte une réponse incertaine ou étrangère à la disponibilité sans second versement', async err => {
    const send = vi.spyOn(payments.stripe.payouts, 'create').mockRejectedValueOnce(err).mockResolvedValue(paid);
    const record = vi.fn(async () => {});
    await expect(payments.createPayout({ ...input, onStandardFallback: record })).rejects.toBe(err);
    expect(send).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  it('retrouve le même versement si le service l’a accepté avant la coupure de connexion', async () => {
    const receipts = new Map<string, Stripe.Response<Stripe.Payout>>();
    const send = vi.spyOn(payments.stripe.payouts, 'create').mockImplementation(async (_body, options) => {
      const key = options?.idempotencyKey;
      if (!key) throw new Error('clé de reprise absente');
      const previous = receipts.get(key);
      if (previous) return previous;
      receipts.set(key, paid);
      throw new Stripe.errors.StripeConnectionError({ message: 'réponse perdue après acceptation' });
    });
    await expect(payments.createPayout(input)).rejects.toThrow('réponse perdue');
    await expect(payments.createPayout(input)).resolves.toBe(paid);
    expect(send).toHaveBeenCalledTimes(2);
    expect(receipts.size).toBe(1);
  });

  it('utilise des clés différentes pour deux réservations du même prestataire', async () => {
    const send = vi.spyOn(payments.stripe.payouts, 'create').mockResolvedValue(paid);
    await payments.createPayout(input);
    await payments.createPayout({ ...input, reservationId: 'reservation-456' });
    expect(send.mock.calls[0][1]?.idempotencyKey).not.toBe(send.mock.calls[1][1]?.idempotencyKey);
  });

  it('reprend directement le mode standard déjà mémorisé', async () => {
    const send = vi.spyOn(payments.stripe.payouts, 'create').mockResolvedValue(paid);
    await payments.createPayout({ ...input, method: 'standard' });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]).toEqual([
      expect.objectContaining({ method: 'standard' }),
      { stripeAccount: input.accountId, idempotencyKey: 'kala:payout:reservation-123:standard' },
    ]);
  });

  it('interrompt le versement si la mémorisation du mode standard échoue', async () => {
    const send = vi.spyOn(payments.stripe.payouts, 'create').mockRejectedValueOnce(unsupported()).mockResolvedValue(paid);
    const failure = new Error('journal indisponible');
    await expect(payments.createPayout({
      ...input, onStandardFallback: async () => { throw failure; },
    })).rejects.toBe(failure);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
