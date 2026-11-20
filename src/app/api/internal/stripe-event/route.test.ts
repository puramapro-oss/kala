import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';

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
