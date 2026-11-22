import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';
import { createPayout, transferToProf } from '@/lib/stripe';
import { sendCoursTermineEmail } from '@/lib/resend';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ createServiceClient: () => ({ rpc }) }));
vi.mock('@/lib/stripe', () => ({ transferToProf: vi.fn(), createPayout: vi.fn() }));
vi.mock('@/lib/resend', () => ({ sendCoursTermineEmail: vi.fn() }));

const reservation = '287be215-61ff-498c-abc5-b7a9fa72cc79';
const body = { id: 'evt_local', type: 'reservation.terminee', data: { object: { id: reservation } } };
const signed = (raw: string) => createHmac('sha256', 'test-signature').update(raw).digest('hex');
function request(raw = JSON.stringify(body), signature: string | null = signed(raw)) {
  return new Request('http://localhost/api/internal/stripe-event', {
    method: 'POST',
    body: raw,
    headers: signature === null ? {} : { 'X-Karma-Signature': signature },
  });
}
beforeEach(() => {
  vi.stubEnv('KARMA_SHARED_SECRET', 'test-signature');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_fixture');
  rpc.mockReset();
  vi.mocked(createPayout).mockReset();
  vi.mocked(transferToProf).mockReset();
  vi.mocked(sendCoursTermineEmail).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

it('requires a dispatcher signature', async () => {
  expect((await POST(request(JSON.stringify(body), null))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects a different signature before using the database', async () => {
  expect((await POST(request(JSON.stringify(body), 'a'.repeat(64)))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  '{',
  JSON.stringify({ ...body, data: {} }),
  JSON.stringify({ ...body, data: { object: { id: 'x' } } }),
])('rejects invalid signed input without any side effect', async (raw) => {
  expect((await POST(request(raw))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  { ...body, type: 'unrelated.event' },
  { ...body, account: 'acct_external' },
  {
    ...body,
    type: 'payment_intent.succeeded',
    data: { object: { metadata: { app_id: 'pashu', reservation_id: reservation } } },
  },
])('acknowledges foreign and unhandled events without reserving their shared event IDs', async (event) => {
  expect((await POST(request(JSON.stringify(event)))).status).toBe(200);
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects a signed live event at a test-mode receiver', async () => {
  expect((await POST(request(JSON.stringify({ ...body, livemode: true })))).status).toBe(409);
  expect(rpc).not.toHaveBeenCalled();
});
it('preserves the processed-event reply after a durable receipt', async () => {
  rpc.mockResolvedValueOnce({ data: 'processed', error: null });
  const response = await POST(request());
  expect(await response.json()).toMatchObject({ eventId: 'evt_local', skipped: true });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('reports a retryable database failure without echoing database internals', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'private-provider-details' } });
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private-provider-details');
});

const payment = {
  id: 'pi_local', amount: 2500, amount_received: 2500, currency: 'eur', livemode: false,
  metadata: { reservation_id: reservation },
};
const paymentEvent = (object: unknown) => JSON.stringify({
  id: 'evt_payment_local', type: 'payment_intent.succeeded', livemode: false, data: { object },
});
it('preserves optional payment metadata and integer amounts', async () => {
  rpc.mockResolvedValueOnce({ data: 'processed', error: null });
  expect((await POST(request(paymentEvent(payment)))).status).toBe(200);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('kala_recevoir_evenement', {
    p_id: 'evt_payment_local', p_type: 'payment_intent.succeeded',
    p_details: {
      live: false, reservation_id: reservation, intent: 'pi_local', amount: 2500,
      received: 2500, currency: 'eur', app: null, user: null, account: null,
    },
  });
});
it.each([
  { ...payment, amount: -1 }, { ...payment, amount_received: 0.5 },
  { ...payment, amount: 2_147_483_648 },
  { ...payment, metadata: { reservation_id: '287be215-61ff-498c-0bc5-b7a9fa72cc79' } },
  { ...payment, metadata: { reservation_id: reservation, user_id: 'invalid' } },
])('rejects invalid payment amounts or UUIDs before recording an event', async object => {
  expect((await POST(request(paymentEvent(object)))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  { action: 'transfer', account: 'acct_local', amount: 0 },
  { action: 'payout', account: 'acct_local', amount: 2500, method: 'unknown' },
  { action: 'email', email: 'invalid-address', name: 'Local', amount: 2500 },
  { action: 'cashback', fees: -1 }, { action: 'unknown' },
])('rejects an invalid settlement plan before any provider call', async invalidPlan => {
  rpc.mockResolvedValueOnce({ data: 'settle', error: null })
    .mockResolvedValueOnce({ data: invalidPlan, error: null });
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Confirmation indisponible', eventId: 'evt_local' });
  expect(createPayout).not.toHaveBeenCalled();
  expect(transferToProf).not.toHaveBeenCalled();
  expect(sendCoursTermineEmail).not.toHaveBeenCalled();
});
it.each([
  [{ action: 'done' }, 200],
  [{ action: 'busy' }, 503],
  [{ action: 'review', reason: 'local_review' }, 503],
] as const)('preserves the control branch %j', async (plan, status) => {
  rpc.mockResolvedValueOnce({ data: 'settle', error: null })
    .mockResolvedValueOnce({ data: plan, error: null })
    .mockResolvedValueOnce({ data: 'processed', error: null });
  expect((await POST(request())).status).toBe(status);
  expect(createPayout).not.toHaveBeenCalled();
  expect(transferToProf).not.toHaveBeenCalled();
  expect(sendCoursTermineEmail).not.toHaveBeenCalled();
});
it('preserves valid email and continuation plans with a simulated provider receipt', async () => {
  rpc.mockResolvedValueOnce({ data: 'settle', error: null })
    .mockResolvedValueOnce({ data: { action: 'email', email: 'local+course@example.invalid', name: 'Local', amount: 2500 }, error: null })
    .mockResolvedValueOnce({ data: { action: 'continue' }, error: null })
    .mockResolvedValueOnce({ data: { action: 'done' }, error: null })
    .mockResolvedValueOnce({ data: 'processed', error: null });
  vi.mocked(sendCoursTermineEmail).mockResolvedValueOnce('email_local_receipt');
  expect((await POST(request())).status).toBe(200);
  expect(sendCoursTermineEmail).toHaveBeenCalledExactlyOnceWith(
    'local+course@example.invalid', 'Local', 2500, `kala-cours-termine:${reservation}`,
  );
  expect(rpc).toHaveBeenCalledWith('kala_avancer_reglement', expect.objectContaining({
    p_action: 'email_receipt', p_reference: 'email_local_receipt',
  }));
  expect(createPayout).not.toHaveBeenCalled();
  expect(transferToProf).not.toHaveBeenCalled();
});
