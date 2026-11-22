import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as withdraw } from './wallet/withdraw/route';
import { GET as readTimeline, POST as writeTimeline } from './enregistrements/route';
import { POST as reserve } from './reservations/route';
import { POST as checkout } from './stripe/checkout/route';
import { POST as deleteAccount } from './account/delete/route';
import { POST as acceptLegal } from './legal/accept/route';
import { POST as consent } from './legal/cookie-consent/route';
import { CURRENT_LEGAL_VERSIONS } from '@/lib/legal/versions';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
  or: vi.fn(), upsert: vi.fn(), rpc: vi.fn(), createCheckout: vi.fn(), cancel: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  rateLimitByUser: async () => ({ success: true }),
}));
vi.mock('@/lib/stripe', () => ({
  createReservationCheckout: mocks.createCheckout,
  stripe: { paymentIntents: { cancel: mocks.cancel } },
}));

const uuid = '287be215-61ff-498c-abc5-b7a9fa72cc79';
let userSequence = 0;
function request(body: unknown) {
  return new NextRequest('http://localhost/api/local-validation-fixture', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
}
async function invalid(handler: (req: NextRequest) => Promise<Response>, body: unknown, field?: string) {
  const response = await handler(request(body));
  expect(response.status).toBe(400);
  const payload = await response.json();
  expect(payload.error).toEqual(expect.any(String));
  if (field) {
    expect(payload.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: [field], message: expect.any(String) }),
    ]));
  }
  expect(mocks.from).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: `local-validation-${++userSequence}` } }, error: null });
  mocks.single.mockResolvedValue({ data: null, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.or.mockResolvedValue({ data: [], error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    single: mocks.single, maybeSingle: mocks.maybeSingle, or: mocks.or, upsert: mocks.upsert,
  };
  mocks.from.mockReturnValue(query);
});
afterEach(() => {
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.createCheckout).not.toHaveBeenCalled();
  expect(mocks.cancel).not.toHaveBeenCalled();
});

describe('validation du retrait avant tout débit', () => {
  it.each([0, -1, 4.99, '5', false, null, undefined])('refuse le montant %s avec une erreur client', async amount => {
    await invalid(withdraw, { amount_euros: amount });
  });
  it('conserve le message français du minimum de 5 euros', async () => {
    const response = await withdraw(request({ amount_euros: 4.99 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Retrait minimum : 5€' });
  });
  it.each([5, 5.01, 10.5])('accepte %s puis applique le contrôle du profil', async amount => {
    const response = await withdraw(request({ amount_euros: amount }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Profil introuvable' });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('profils');
  });
});

describe('validation des entrées du journal', () => {
  const note = { reservation_id: uuid, typeEntree: 'note' };
  it.each([
    ['reservation_id', 'invalide'],
    ['reservation_id', '287be215-61ff-498c-0bc5-b7a9fa72cc79'],
    ['typeEntree', 'promenade'], ['contenuTexte', 42], ['contenuTexte', null],
    ['photoUrl', 'sans-url'], ['photoUrl', null],
  ])('refuse %s=%s et conserve les détails de validation', async (field, value) => {
    await invalid(writeTimeline, { ...note, [String(field)]: value }, String(field));
  });
  it.each([
    note,
    { ...note, reservation_id: '0193a0d1-7b5c-7000-8000-000000000001' },
    { ...note, contenuTexte: '' },
    { ...note, typeEntree: 'photo', photoUrl: 'https://example.invalid/photo.jpg' },
  ])('accepte un UUID RFC et les champs optionnels valides', async body => {
    expect((await writeTimeline(request(body))).status).toBe(404);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('profils');
  });
  it.each(['', 'invalide', '287be215-61ff-498c-0bc5-b7a9fa72cc79'])('refuse aussi un identifiant de lecture invalide : %s', async id => {
    const response = await readTimeline(new NextRequest(`http://localhost/api/enregistrements?reservation_id=${id}`));
    expect(response.status).toBe(400);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('accepte un identifiant de lecture valide avant les contrôles d’accès', async () => {
    expect((await readTimeline(new NextRequest(`http://localhost/api/enregistrements?reservation_id=${uuid}`))).status).toBe(404);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('profils');
  });
});

describe('validation des réservations et du paiement', () => {
  const reservation = {
    prestataireId: uuid, typeGarde: 'domicile', tarifCents: 2500,
    debutLe: '2026-11-25T10:00:00.000Z', finLe: '2026-11-25T11:00:00.000Z',
  };
  it.each([
    ['prestataireId', 'invalide'], ['typeGarde', 'promenade'],
    ['debutLe', '2026-11-25'], ['finLe', '2026-11-25T12:00:00+01:00'],
    ['tarifCents', 0], ['tarifCents', -1], ['tarifCents', 25.5], ['tarifCents', '2500'],
    ['tarifCents', Number.MAX_SAFE_INTEGER + 1],
  ])('refuse une réservation invalide : %s=%s', async (field, value) => {
    await invalid(reserve, { ...reservation, [String(field)]: value }, String(field));
  });
  it.each(['domicile', 'visite'])('conserve les dates UTC, les centimes et le cours %s', async typeGarde => {
    expect((await reserve(request({ ...reservation, typeGarde }))).status).toBe(404);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('profils');
  });
  it.each(['invalide', null, '287be215-61ff-498c-0bc5-b7a9fa72cc79'])('refuse le checkout avec UUID %s', async reservationId => {
    await invalid(checkout, { reservationId }, 'reservationId');
  });
  it('conserve un UUID valide avant toute création de paiement', async () => {
    expect((await checkout(request({ reservationId: uuid }))).status).toBe(404);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('reservations');
  });
});

describe('validation des choix légaux et du compte', () => {
  it.each([
    { confirm: 'DELETE' }, { confirm: 'DELETE_MY_ACCOUNT', reason: null },
    { confirm: 'DELETE_MY_ACCOUNT', reason: 'x'.repeat(501) },
  ])('refuse une suppression sans confirmation exacte et raison valide', async body => {
    await invalid(deleteAccount, body);
  });
  it.each([undefined, '', 'x'.repeat(500)])('conserve une raison optionnelle dans la demande de suppression', async reason => {
    const response = await deleteAccount(request({ confirm: 'DELETE_MY_ACCOUNT', reason }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, grace_period_days: 30 });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      reason: reason ?? null, status: 'scheduled', app_id: 'kala',
    }), { onConflict: 'app_id,user_id' });
  });
  it.each(['mentions', 'cgu', 'cgv', 'confidentialite'] as const)('conserve le document %s et sa version serveur', async docType => {
    expect((await acceptLegal(request({ docType, version: 'version-client-fausse' }))).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      doc_type: docType, version: CURRENT_LEGAL_VERSIONS[docType], app_id: 'kala',
    }), { onConflict: 'app_id,user_id,doc_type' });
  });
  it.each(['invalide', null, 42])('refuse un document inconnu %s', async docType => {
    await invalid(acceptLegal, { docType });
  });
  it.each([
    { mesure: false, marketing: false }, { mesure: true, marketing: false },
    { mesure: false, marketing: true }, { mesure: true, marketing: true },
  ])('préserve les deux booléens de consentement sans coercition', async body => {
    const response = await consent(request(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, synced: true });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      ...body, necessaire: true, app_id: 'kala',
    }), { onConflict: 'app_id,user_id' });
  });
  it.each([{ mesure: 'false', marketing: false }, { mesure: null, marketing: true }, {}])('refuse les consentements incomplets ou de mauvais type', async body => {
    await invalid(consent, body);
  });
});
