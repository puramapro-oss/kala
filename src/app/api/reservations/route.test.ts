import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  service: null as unknown,
  getUser: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => mocks.service,
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimitByUser: mocks.rateLimit }));

const profId = 'c0000000-0000-4000-8000-000000000001';
const profilId = 'c0000000-0000-4000-8000-000000000002';
const userId = 'c0000000-0000-4000-8000-000000000003';
const requestBody = {
  prestataireId: profId,
  typeGarde: 'domicile',
  debutLe: '2026-12-01T10:00:00.000Z',
  finLe: '2026-12-01T11:00:00.000Z',
  tarifCents: 2500,
};
type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;
let writes: Row[];
let requests: { table: string; method: string; search: string }[];
let readError: string | null;
let insertError: string | null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// The real Supabase/PostgREST client builds and sends every query to this in-memory
// transport. Unknown queries throw; no URL is sent to a real database or provider.
function matches(row: Row, column: string, expression: string): boolean {
  const separator = expression.indexOf('.');
  const operator = expression.slice(0, separator);
  const value = expression.slice(separator + 1);
  if (operator === 'eq') return String(row[column]) === value;
  if (operator === 'in') return value.slice(1, -1).split(',').includes(String(row[column]));
  const left = Date.parse(String(row[column]));
  const right = Date.parse(value);
  if (operator === 'lt') return left < right;
  if (operator === 'lte') return left <= right;
  if (operator === 'gt') return left > right;
  if (operator === 'gte') return left >= right;
  throw new Error(`Unsupported fixture filter: ${column}.${expression}`);
}

async function localFetch(input: RequestInfo | URL, init?: RequestInit) {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.origin !== 'http://kala-fixture.invalid') throw new Error('External request blocked');
  const table = url.pathname.replace('/rest/v1/', '');
  if (!Object.hasOwn(rows, table)) throw new Error(`Unexpected fixture table: ${table}`);
  requests.push({ table, method: req.method, search: url.search });
  expect(req.headers.get(req.method === 'GET' ? 'accept-profile' : 'content-profile')).toBe('purama_marketplace');

  if (req.method === 'POST' && table === 'reservations') {
    if (insertError) return json({ code: insertError, message: 'Fixture write rejected' }, 409);
    const row = { id: 'c0000000-0000-4000-8000-000000000004', ...await req.json() };
    writes.push(row);
    return json(row, 201);
  }
  if (req.method !== 'GET') throw new Error(`Unexpected fixture method: ${req.method}`);
  if (readError === table) return json({ code: 'XX000', message: 'Fixture read failure' }, 500);

  let selected = rows[table].filter(row => [...url.searchParams].every(([column, filter]) => {
    if (['select', 'limit'].includes(column)) return true;
    if (column === 'or') {
      return filter.slice(1, -1).split(',').some(term => {
        const dot = term.indexOf('.');
        return matches(row, term.slice(0, dot), term.slice(dot + 1));
      });
    }
    return matches(row, column, filter);
  }));
  const limit = url.searchParams.get('limit');
  if (limit) selected = selected.slice(0, Number(limit));
  if (req.headers.get('accept')?.includes('application/vnd.pgrst.object+json')) {
    if (selected.length !== 1) return json({ code: 'PGRST116', details: `The result contains ${selected.length} rows`, message: 'Expected one row' }, 406);
    return json(selected[0]);
  }
  return json(selected);
}

function request(body: unknown = requestBody) {
  return new NextRequest('http://localhost/api/reservations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  rows = {
    profils: [{ id: profilId, app_id: 'kala', user_id: userId }],
    prestataires: [{ id: profId, app_id: 'kala', statut_verification: 'verifie' }],
    prestations: [
      { app_id: 'kala', prestataire_id: profId, type_garde: 'domicile', prix_cents: 2500, actif: true },
      { app_id: 'kala', prestataire_id: profId, type_garde: 'visite', prix_cents: 3000, actif: true },
    ],
    reservations: [],
  };
  writes = [];
  requests = [];
  readError = null;
  insertError = null;
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.service = createClient('http://kala-fixture.invalid', 'fixture-only-key', {
    db: { schema: 'purama_marketplace' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localFetch },
  });
});
afterEach(() => vi.restoreAllMocks());

describe('reservation admission uses the authoritative offer', () => {
  it.each([['domicile', 2500, 225], ['visite', 3000, 270]])('reserves the active %s offer with its exact cents', async (typeGarde, tarifCents, fees) => {
    const response = await POST(request({ ...requestBody, typeGarde, tarifCents, recurrence: 'hebdomadaire' }));
    expect(response.status).toBe(201);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ app_id: 'kala', client_profil_id: profilId, prestataire_id: profId, type_garde: typeGarde,
      tarif_cents: tarifCents, frais_service_cents: fees, recurrence: 'aucune', statut: 'en_attente_paiement' });
    expect(writes[0]).not.toHaveProperty('total_client_cents');
  });

  it.each([1, 2499, 2501, 999999])('rejects client quote %s when the current offer is 2500 cents', async tarifCents => {
    const response = await POST(request({ ...requestBody, tarifCents }));
    expect(response.status).toBe(409);
    expect(writes).toEqual([]);
  });
  it('rejects an outdated display price when the professor changed the offer', async () => {
    rows.prestations[0].prix_cents = 2800;
    expect((await POST(request())).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it.each(['brouillon', 'en_attente', 'refuse', 'suspendu'])('does not reserve an unverified professor (%s)', async status => {
    rows.prestataires[0].statut_verification = status;
    expect((await POST(request())).status).toBe(404);
    expect(writes).toEqual([]);
  });
  it.each(['profils', 'prestataires', 'prestations'])('does not reuse a %s row from another tenant', async table => {
    rows[table].forEach(row => { row.app_id = 'pashu'; });
    expect([404, 409]).toContain((await POST(request())).status);
    expect(writes).toEqual([]);
  });
  it('does not reserve a disabled course', async () => {
    rows.prestations[0].actif = false;
    expect((await POST(request())).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it('does not substitute the other course type when the requested offer is missing', async () => {
    rows.prestations.shift();
    expect((await POST(request())).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it.each(['profils', 'prestataires', 'prestations', 'reservations'])('fails closed on %s read failure', async table => {
    readError = table;
    expect((await POST(request())).status).toBe(500);
    expect(writes).toEqual([]);
  });
});

describe('reservation intervals match the half-open database exclusion range', () => {
  it.each([
    ['earlier', '08:00', '09:00'], ['later', '12:00', '13:00'],
    ['touches the start', '09:00', '10:00'], ['touches the end', '11:00', '12:00'],
  ])('accepts a slot that %s without overlapping', async (_name, start, end) => {
    rows.reservations.push({ app_id: 'kala', prestataire_id: profId, statut: 'confirmee',
      debut_le: `2026-12-01T${start}:00.000Z`, fin_le: `2026-12-01T${end}:00.000Z` });
    expect((await POST(request())).status).toBe(201);
    expect(writes).toHaveLength(1);
  });
  it.each([
    ['09:30', '10:30'], ['10:30', '11:30'], ['10:15', '10:45'], ['09:00', '12:00'], ['10:00', '11:00'],
  ])('rejects an overlapping confirmed slot %s–%s', async (start, end) => {
    rows.reservations.push({ app_id: 'kala', prestataire_id: profId, statut: 'confirmee',
      debut_le: `2026-12-01T${start}:00.000Z`, fin_le: `2026-12-01T${end}:00.000Z` });
    expect((await POST(request())).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it.each(['annulee_client', 'annulee_gardien', 'en_attente_paiement', 'terminee'])('ignores the nonblocking status %s', async statut => {
    rows.reservations.push({ app_id: 'kala', prestataire_id: profId, statut, debut_le: requestBody.debutLe, fin_le: requestBody.finLe });
    expect((await POST(request())).status).toBe(201);
  });
  it('rejects an overlapping course already in progress', async () => {
    rows.reservations.push({ app_id: 'kala', prestataire_id: profId, statut: 'en_cours', debut_le: requestBody.debutLe, fin_le: requestBody.finLe });
    expect((await POST(request())).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it.each(['2026-12-01T10:00:00.000Z', '2026-12-01T09:00:00.000Z'])('rejects an empty or reversed interval ending at %s before database access', async finLe => {
    const response = await POST(request({ ...requestBody, finLe }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ path: ['finLe'] })]) });
    expect(requests).toEqual([]);
  });
  it('returns a conflict when the database exclusion rejects the write', async () => {
    insertError = '23P01';
    expect((await POST(request())).status).toBe(409);
    expect(writes).toEqual([]);
  });
});

describe('invalid requests have no reservation side effects', () => {
  it('returns 400 for malformed JSON instead of leaking a server error', async () => {
    const response = await POST(new NextRequest('http://localhost/api/reservations', { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
    expect(requests).toEqual([]);
  });
  it('rejects unauthenticated access before database reads', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(requests).toEqual([]);
  });
  it('keeps the rate limit before all reads and writes', async () => {
    mocks.rateLimit.mockResolvedValue({ success: false, retryAfter: 5000 });
    expect((await POST(request())).status).toBe(429);
    expect(requests).toEqual([]);
  });
});
