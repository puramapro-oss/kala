import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { beforeEach, expect, it, vi } from 'vitest';

const exec = promisify(execFile);
const remote = vi.hoisted(() => ({ transfer: vi.fn(), payout: vi.fn(), email: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-server', () => ({ createServiceClient: () => ({ rpc: remote.rpc }) }));
vi.mock('stripe', async (getActual) => {
  const { default: Stripe } = await getActual<typeof import('stripe')>();
  return {
    default: class {
      static errors = Stripe.errors;
      transfers = { create: remote.transfer };
      payouts = { create: remote.payout };
    },
  };
});
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: remote.email };
  },
}));
import Stripe from 'stripe';
import { POST } from '../../src/app/api/internal/stripe-event/route';

const quote = (value: unknown) => (value == null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'");
async function sql(statement: string) {
  const { stdout } = await exec(process.env.PSQL!, ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', statement]);
  return stdout.trim();
}
const schema = 'purama_marketplace';
async function callDatabase(name: string, args: Record<string, unknown>) {
  let params: unknown[];
  if (name === 'kala_recevoir_evenement') params = [args.p_id, args.p_type, JSON.stringify(args.p_details)];
  else if (name === 'kala_avancer_reglement')
    params = [args.p_reservation, args.p_action, args.p_titulaire, args.p_reference, args.p_cents];
  else throw new Error('Unexpected RPC');
  const text = await sql(
    `SET ROLE service_role; SELECT to_jsonb(${schema}.${name}(${params.map(quote).join(',')}))::text`,
  );
  return { data: JSON.parse(text), error: null };
}
async function send(id: string, type: string, object: unknown) {
  const raw = JSON.stringify({ id, type, livemode: false, data: { object } });
  const signature = createHmac('sha256', process.env.KARMA_SHARED_SECRET!).update(raw).digest('hex');
  return POST(
    new Request('http://localhost/api/internal/stripe-event', {
      method: 'POST',
      body: raw,
      headers: { 'X-Karma-Signature': signature },
    }),
  );
}
async function seed(app = 'kala') {
  const customer = randomUUID(),
    teacher = randomUUID(),
    client = randomUUID(),
    prof = randomUUID(),
    prest = randomUUID(),
    id = randomUUID();
  const account = 'acct_' + prest,
    intent = 'pi_' + id;
  await sql(`SET search_path TO ${schema},public;
    INSERT INTO auth.users VALUES ('${customer}','client@example.invalid'),('${teacher}','prof@example.invalid');
    INSERT INTO profils(id,app_id,user_id,affichage_nom) VALUES ('${client}','${app}','${customer}','Client'),('${prof}','${app}','${teacher}','Prof <Test>');
    INSERT INTO prestataires(id,app_id,profil_id,titre,presentation,commune,code_postal,latitude,longitude,stripe_account_id)
    VALUES('${prest}','${app}','${prof}','Cours','Cours','Ville','00000',0,0,'${account}');
    INSERT INTO reservations(id,app_id,client_profil_id,prestataire_id,type_garde,debut_le,fin_le,tarif_cents,frais_service_cents,statut)
    VALUES('${id}','${app}','${client}','${prest}','visite',now()-interval '2 hours',now()-interval '1 hour',10000,900,'en_attente_paiement')`);
  const payment = {
    id: intent,
    livemode: false,
    amount: 10900,
    amount_received: 10900,
    currency: 'eur',
    metadata: { app_id: app, reservation_id: id, user_id: customer, prof_account_id: account },
  };
  return {
    id,
    client,
    prof,
    prest,
    account,
    intent,
    payment,
    charge: (event = randomUUID()) => send(event, 'payment_intent.succeeded', payment),
    complete: (event = randomUUID()) => send(event, 'reservation.terminee', { id }),
  };
}
type Fixture = Awaited<ReturnType<typeof seed>>;
async function paid(f: Fixture) {
  expect((await f.charge()).status).toBe(200);
  await sql(`UPDATE ${schema}.reservations SET statut='en_cours' WHERE id='${f.id}'`);
}
const read = (f: Fixture, fields: string) =>
  sql(`SELECT ${fields} FROM ${schema}.kala_reglements WHERE reservation_id='${f.id}'`);
beforeEach(async () => {
  expect(await sql('SHOW data_directory')).toBe(process.env.KALA_FIXTURE_DATA);
  vi.resetAllMocks();
  remote.rpc.mockImplementation(callDatabase);
  remote.transfer.mockImplementation(async (p) => ({
    ...p,
    id: 'tr_' + p.transfer_group,
    livemode: false,
    reversed: false,
    amount_reversed: 0,
  }));
  remote.payout.mockImplementation(async (p) => ({
    ...p,
    id: 'po_' + p.metadata.reservation_id,
    livemode: false,
    status: 'pending',
  }));
  remote.email.mockImplementation(async (_p, opts) => ({
    data: { id: 'em_' + opts.idempotencyKey },
    error: null,
  }));
});
it('honours the shipped schema and records each receipt, credit and notification exactly once', async () => {
  const f = await seed();
  const first = randomUUID();
  expect((await f.charge(first)).status).toBe(200);
  expect((await f.charge(first)).status).toBe(200);
  await paid(f);
  const eid = randomUUID();
  expect((await f.complete(eid)).status).toBe(200);
  expect((await f.complete(eid)).status).toBe(200);
  expect((await f.complete()).status).toBe(200);
  expect(await read(f, "concat_ws('|',phase,transfert_id,versement_id,cashback_cents,email_id)")).toBe(
    `done|tr_${f.id}|po_${f.id}|433|em_kala-cours-termine:${f.id}`,
  );
  expect(await sql(`SELECT count(*) FROM ${schema}.mouvements_argent WHERE reservation_id='${f.id}'`)).toBe(
    '2',
  );
  expect(await sql(`SELECT solde_cents FROM ${schema}.wallets WHERE profil_id='${f.client}'`)).toBe('433');
  expect(remote.transfer).toHaveBeenCalledTimes(1);
  expect(remote.payout).toHaveBeenCalledTimes(1);
  expect(remote.email).toHaveBeenCalledTimes(1);
  expect(remote.email.mock.calls[0][0]).toMatchObject({ to: 'prof@example.invalid' });
  expect(remote.email.mock.calls[0][0].html).toContain('Prof &lt;Test&gt;');
});

it('serializes concurrent deliveries with distinct event identifiers for one PaymentIntent', async () => {
  const f = await seed();
  const responses = await Promise.all(Array.from({ length: 6 }, () => f.charge()));
  expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
  expect(
    await sql(
      `SELECT count(*) FROM ${schema}.mouvements_argent WHERE reservation_id='${f.id}' AND reference_stripe='${f.intent}'`,
    ),
  ).toBe('1');
  expect(await sql(`SELECT statut FROM ${schema}.reservations WHERE id='${f.id}'`)).toBe('confirmee');
});
it('a second completion cannot take an in-flight transfer and can finish after its owner', async () => {
  const f = await seed();
  await paid(f);
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    entered = r;
  });
  remote.transfer.mockImplementationOnce(async (p) => {
    entered();
    await gate;
    return { ...p, id: 'tr_' + f.id, livemode: false, reversed: false, amount_reversed: 0 };
  });
  const owner = f.complete();
  await started;
  try {
    const peer = await f.complete();
    expect(peer.status).toBe(503);
    expect((await peer.json()).reason).toBe('busy');
  } finally {
    release();
  }
  expect((await owner).status).toBe(200);
  expect((await f.complete()).status).toBe(200);
  expect(remote.transfer).toHaveBeenCalledTimes(1);
  expect(remote.payout).toHaveBeenCalledTimes(1);
  expect(remote.email).toHaveBeenCalledTimes(1);
});
it.each(['transfer', 'payout', 'email'] as const)(
  'holds an unconfirmed %s without reissuing it on another delivery',
  async (effect) => {
    const f = await seed();
    await paid(f);
    remote[effect].mockRejectedValueOnce(new Error('response lost'));
    const first = await f.complete();
    expect(first.status).toBe(503);
    expect((await first.json()).reason).toBe(`${effect}_inflight_receipt_missing`);
    expect((await f.complete()).status).toBe(503);
    expect(remote[effect]).toHaveBeenCalledTimes(1);
    expect(await read(f, 'phase')).toBe(effect + '_inflight');
    expect(remote.payout).toHaveBeenCalledTimes(effect === 'transfer' ? 0 : 1);
    expect(remote.email).toHaveBeenCalledTimes(effect === 'email' ? 1 : 0);
    expect(await sql(`SELECT count(*) FROM ${schema}.wallet_mouvements WHERE reservation_id='${f.id}'`)).toBe(
      effect === 'email' ? '1' : '0',
    );
  },
);
it.each(['transfer_receipt', 'payout_receipt', 'cashback', 'email_receipt'] as const)(
  'resumes from the committed %s when the database reply is lost',
  async (action) => {
    const f = await seed();
    await paid(f);
    let lost = false;
    remote.rpc.mockImplementation(async (name, args) => {
      const result = await callDatabase(name, args);
      if (!lost && args.p_action === action) {
        lost = true;
        throw new Error('database acknowledgement lost');
      }
      return result;
    });
    const eid = randomUUID();
    expect((await f.complete(eid)).status).toBe(503);
    expect((await f.complete(eid)).status).toBe(200);
    expect(lost).toBe(true);
    expect(await read(f, 'phase')).toBe('done');
    expect(remote.transfer).toHaveBeenCalledTimes(1);
    expect(remote.payout).toHaveBeenCalledTimes(1);
    expect(remote.email).toHaveBeenCalledTimes(1);
    expect(await sql(`SELECT count(*) FROM ${schema}.wallet_mouvements WHERE reservation_id='${f.id}'`)).toBe(
      '1',
    );
  },
);
it('holds an old in-flight claim when no provider receipt reached PostgreSQL', async () => {
  const f = await seed();
  await paid(f);
  let failed = false;
  remote.rpc.mockImplementation(async (name, args) => {
    if (!failed && args.p_action === 'transfer_receipt') {
      failed = true;
      throw new Error('database write unavailable');
    }
    return callDatabase(name, args);
  });
  expect((await f.complete()).status).toBe(503);
  await sql(
    `UPDATE ${schema}.kala_reglements SET tentative_le=now()-interval '2 days' WHERE reservation_id='${f.id}'`,
  );
  const retry = await f.complete();
  expect(retry.status).toBe(503);
  expect((await retry.json()).reason).toBe('transfer_inflight_receipt_missing');
  expect(remote.transfer).toHaveBeenCalledTimes(1);
  expect(remote.payout).not.toHaveBeenCalled();
});
it('records the definitive refusal before allowing the standard payout', async () => {
  const f = await seed();
  await paid(f);
  remote.payout.mockRejectedValueOnce(
    new Stripe.errors.StripeInvalidRequestError({
      code: 'instant_payouts_unsupported',
      statusCode: 400,
      message: 'synthetic rejection',
    }),
  );
  const eid = randomUUID();
  expect((await f.complete(eid)).status).toBe(200);
  expect(await read(f, 'methode')).toBe('standard');
  expect(remote.payout.mock.calls.map(([input]) => input.method)).toEqual(['instant', 'standard']);
  expect(remote.payout.mock.calls[1][1]).toMatchObject({
    stripeAccount: f.account,
    idempotencyKey: `kala:payout:${f.id}:standard`,
  });
});
it('a lost fallback-decision acknowledgement resumes in standard-only mode', async () => {
  const f = await seed();
  await paid(f);
  remote.payout.mockRejectedValueOnce(
    new Stripe.errors.StripeInvalidRequestError({
      code: 'instant_payouts_unsupported',
      statusCode: 400,
      message: 'synthetic rejection',
    }),
  );
  let lost = false;
  remote.rpc.mockImplementation(async (name, args) => {
    const result = await callDatabase(name, args);
    if (!lost && args.p_action === 'standard_allowed') {
      lost = true;
      throw Error('lost');
    }
    return result;
  });
  expect((await f.complete()).status).toBe(503);
  expect(await read(f, "phase||'/'||methode")).toBe('payout_ready/standard');
  expect((await f.complete()).status).toBe(200);
  expect(remote.payout.mock.calls.map(([input]) => input.method)).toEqual(['instant', 'standard']);
});
it('does not interpret an SDK email error response as a delivery receipt', async () => {
  const f = await seed();
  await paid(f);
  remote.email.mockResolvedValueOnce({ data: null, error: { message: 'fixture provider unavailable' } });
  expect((await f.complete()).status).toBe(503);
  expect((await f.complete()).status).toBe(503);
  expect(await read(f, "phase||'/'||coalesce(email_id,'none')")).toBe('email_inflight/none');
  expect(remote.email).toHaveBeenCalledTimes(1);
});
it('uses no provider for an email-less teacher after financially completing the course', async () => {
  const f = await seed();
  await paid(f);
  await sql(
    `UPDATE auth.users SET email=NULL WHERE id=(SELECT user_id FROM ${schema}.profils WHERE id='${f.prof}')`,
  );
  expect((await f.complete()).status).toBe(200);
  expect(await read(f, "phase||'/'||observation")).toBe('done/email_address_absent');
  expect(remote.email).not.toHaveBeenCalled();
});
it('protects a receipt collision, an invalid amount and the tenant/actor binding', async () => {
  const f = await seed();
  const a = randomUUID();
  expect((await send(a, 'payment_intent.succeeded', { ...f.payment, amount_received: 1 })).status).toBe(503);
  expect((await f.charge(a)).status).toBe(503);
  expect(
    (
      await send(randomUUID(), 'payment_intent.succeeded', {
        ...f.payment,
        metadata: { ...f.payment.metadata, user_id: randomUUID() },
      })
    ).status,
  ).toBe(503);
  const other = await seed('pashu');
  expect((await other.complete()).status).toBe(503);
  expect((await other.charge()).status).toBe(200);
  expect(
    await sql(
      `SELECT count(*) FROM ${schema}.mouvements_argent WHERE reservation_id IN ('${f.id}','${other.id}')`,
    ),
  ).toBe('0');
  expect(remote.transfer).not.toHaveBeenCalled();
});
it('records an authentic late payment without reopening a completed course, and refuses a cancelled one', async () => {
  const f = await seed();
  await paid(f);
  await sql(`UPDATE ${schema}.reservations SET statut='terminee' WHERE id='${f.id}'`);
  expect((await f.charge()).status).toBe(200);
  expect(await sql(`SELECT statut FROM ${schema}.reservations WHERE id='${f.id}'`)).toBe('terminee');
  const cancelled = await seed();
  await sql(`UPDATE ${schema}.reservations SET statut='annulee_client' WHERE id='${cancelled.id}'`);
  expect((await cancelled.charge()).status).toBe(503);
  expect(await sql(`SELECT statut FROM ${schema}.reservations WHERE id='${cancelled.id}'`)).toBe(
    'annulee_client',
  );
});
it('will not pay an unfinished course or one without a matching payment movement', async () => {
  const f = await seed();
  expect((await f.complete()).status).toBe(503);
  await sql(`UPDATE ${schema}.reservations SET statut='en_cours' WHERE id='${f.id}'`);
  expect((await f.complete()).status).toBe(503);
  expect(remote.transfer).not.toHaveBeenCalled();
  expect(await sql(`SELECT count(*) FROM ${schema}.kala_reglements WHERE reservation_id='${f.id}'`)).toBe(
    '0',
  );
});
it('recognizes historical processed events, quarantines historical pending rows, and guards same IDs across apps', async () => {
  const f = await seed();
  const done = randomUUID(),
    pending = randomUUID(),
    foreign = randomUUID();
  await sql(
    `INSERT INTO ${schema}.stripe_events(event_id,app_id,type,traite_le) VALUES('${done}','kala','reservation.terminee',now()),('${pending}','kala','reservation.terminee',NULL),('${foreign}','pashu','reservation.terminee',NULL)`,
  );
  expect((await f.complete(done)).status).toBe(200);
  expect((await f.complete(pending)).status).toBe(503);
  expect((await f.complete(foreign)).status).toBe(503);
  expect(remote.transfer).not.toHaveBeenCalled();
  expect(await sql(`SELECT erreur FROM ${schema}.stripe_events WHERE event_id='${pending}'`)).toBe(
    'legacy_event_review',
  );
});
it('preserves historical transfers and quarantines ambiguous settlements without backfilling effects', async () => {
  const f = await seed();
  await paid(f);
  await sql(`UPDATE ${schema}.reservations SET stripe_transfer_id='tr_historical' WHERE id='${f.id}'`);
  const result = await f.complete();
  expect(result.status).toBe(503);
  expect((await result.json()).reason).toBe('legacy_settlement_review');
  expect(remote.transfer).not.toHaveBeenCalled();
  expect(await sql(`SELECT stripe_transfer_id FROM ${schema}.reservations WHERE id='${f.id}'`)).toBe(
    'tr_historical',
  );
});
it('admits a pre-migration booking first charged afterwards, but holds previously confirmed history', async () => {
  const proved = await seed();
  await sql(`UPDATE ${schema}.reservations SET cree_le='2000-01-01' WHERE id='${proved.id}'`);
  await paid(proved);
  expect((await proved.complete()).status).toBe(200);
  const old = await seed();
  await sql(
    `UPDATE ${schema}.reservations SET cree_le='2000-01-01',statut='en_cours',stripe_payment_intent_id='${old.intent}' WHERE id='${old.id}'; INSERT INTO ${schema}.mouvements_argent(app_id,reservation_id,categorie,montant_cents,reference_stripe) VALUES('kala','${old.id}','charge_client',10900,'${old.intent}')`,
  );
  const held = await old.complete();
  expect(held.status).toBe(503);
  expect((await held.json()).reason).toBe('legacy_settlement_review');
  expect(remote.transfer).toHaveBeenCalledTimes(1);
});
it('service-only RPCs and a database key isolate concurrent legacy wallet credits', async () => {
  const f = await seed();
  await paid(f);
  expect(
    await sql(
      `SELECT has_function_privilege('authenticated','${schema}.kala_avancer_reglement(uuid,text,uuid,text,integer)','EXECUTE') OR has_function_privilege('anon','${schema}.kala_recevoir_evenement(text,text,jsonb)','EXECUTE') OR has_table_privilege('authenticated','${schema}.kala_reglements','UPDATE')`,
    ),
  ).toBe('f');
  const credit = `SELECT ${schema}.credit_wallet('kala','${f.client}',433,'cashback_karma','${f.id}','legacy-worker')`;
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, () => sql(`SET ROLE service_role; ${credit}`)),
  );
  expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await sql(`SELECT solde_cents FROM ${schema}.wallets WHERE profil_id='${f.client}'`)).toBe('433');
  expect((await f.complete()).status).toBe(503);
  expect(remote.transfer).not.toHaveBeenCalled();
  const other = await seed('pashu');
  const outside = `SELECT ${schema}.credit_wallet('pashu','${other.client}',7,'cashback_karma','${other.id}','existing product')`;
  await sql(outside);
  await sql(outside);
  expect(await sql(`SELECT solde_cents FROM ${schema}.wallets WHERE profil_id='${other.client}'`)).toBe('14');
});

it('applies the migration over existing duplicate cashback and preserves both original rows', async () => {
  const id = '00000000-0000-4000-8000-000000000030';
  const profile = '00000000-0000-4000-8000-000000000011';
  expect(
    await sql(
      `SELECT count(*)||'/'||sum(montant_cents) FROM ${schema}.wallet_mouvements WHERE reservation_id='${id}'`,
    ),
  ).toBe('2/866');
  const response = await send(randomUUID(), 'reservation.terminee', { id });
  expect(response.status).toBe(503);
  expect((await response.json()).reason).toBe('legacy_settlement_review');
  expect(await sql(`SELECT solde_cents FROM ${schema}.wallets WHERE profil_id='${profile}'`)).toBe('866');
  expect(remote.transfer).not.toHaveBeenCalled();
});
it('rejects payment mode mismatch and will not use an unverified provider receipt', async () => {
  const f = await seed();
  expect(
    (await send(randomUUID(), 'payment_intent.succeeded', { ...f.payment, livemode: true })).status,
  ).toBe(409);
  expect(await sql(`SELECT count(*) FROM ${schema}.mouvements_argent WHERE reservation_id='${f.id}'`)).toBe(
    '0',
  );
  await paid(f);
  remote.transfer.mockImplementationOnce(async (p) => ({
    ...p,
    id: 'tr_unverified',
    livemode: true,
    reversed: false,
    amount_reversed: 0,
  }));
  const retry = await f.complete();
  expect(retry.status).toBe(503);
  expect((await retry.json()).reason).toBe('transfer_inflight_receipt_missing');
  expect(remote.payout).not.toHaveBeenCalled();
});
it('accepts a late receipt only from the original external-action owner', async () => {
  const f = await seed();
  await paid(f);
  remote.transfer.mockRejectedValueOnce(Error('delayed reply'));
  expect((await f.complete()).status).toBe(503);
  const owner = await read(f, 'titulaire');
  const affirm = async (token: string) =>
    callDatabase('kala_avancer_reglement', {
      p_reservation: f.id,
      p_action: 'transfer_receipt',
      p_titulaire: token,
      p_reference: 'tr_late',
      p_cents: null,
    });
  expect((await affirm(randomUUID())).data.action).toBe('busy');
  expect((await affirm(owner)).data.action).toBe('continue');
  expect((await f.complete()).status).toBe(200);
  expect(remote.transfer).toHaveBeenCalledTimes(1);
  expect(remote.payout).toHaveBeenCalledTimes(1);
});

it.each([
  { actual: 433, expectedStatus: 200 },
  { actual: 379, expectedStatus: 503 },
])(
  'recognizes or quarantines a carried-over credit of $actual without changing the existing balance',
  async ({ actual, expectedStatus }) => {
    const f = await seed();
    await paid(f);
    let inserted = false;
    remote.rpc.mockImplementation(async (name, args) => {
      if (!inserted && args.p_action === 'cashback') {
        inserted = true;
        await sql(
          `SET ROLE service_role; SELECT ${schema}.credit_wallet('kala','${f.client}',${actual},'cashback_karma','${f.id}','older worker')`,
        );
      }
      return callDatabase(name, args);
    });
    const response = await f.complete();
    expect(response.status).toBe(expectedStatus);
    expect(await sql(`SELECT solde_cents FROM ${schema}.wallets WHERE profil_id='${f.client}'`)).toBe(
      String(actual),
    );
    expect(await sql(`SELECT count(*) FROM ${schema}.wallet_mouvements WHERE reservation_id='${f.id}'`)).toBe(
      '1',
    );
    if (expectedStatus !== 200) expect((await response.json()).reason).toBe('cashback_history_mismatch');
    expect(remote.transfer).toHaveBeenCalledTimes(1);
    expect(remote.payout).toHaveBeenCalledTimes(1);
  },
);
it('réserve les frais inférieurs à la déduction forfaitaire et ne crée pas de crédit nul', async () => {
  const f = await seed();
  await sql(`UPDATE ${schema}.reservations SET frais_service_cents=20 WHERE id='${f.id}'`);
  f.payment.amount = 10020;
  f.payment.amount_received = 10020;
  await paid(f);
  expect((await f.complete()).status).toBe(200);
  expect(await read(f, 'cashback_cents')).toBe('0');
  expect(await sql(`SELECT count(*) FROM ${schema}.wallet_mouvements WHERE reservation_id='${f.id}'`)).toBe(
    '0',
  );
});
