// Run with node --loader ./test/helpers/rotation-loader.mjs ./test/rotationPostgres.mjs
// Requires an EMPTY disposable localhost database named imesul_rotation_test.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fork } from "node:child_process";
import { Pool } from "pg";
import { createLead } from "../Backend.js/salesLeadsStore.js";
import { flushRotationCreationAudit } from "../Backend.js/sellerRotationStore.js";

const url = new URL(process.env.DATABASE_URL || "http://missing");
assert(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/imesul_rotation_test",
  "Only a disposable LOCAL imesul_rotation_test database is allowed");
const db = new Pool({ connectionString: url.href, max: 3 });
const [{ count }] = (await db.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")).rows;
assert.equal(Number(count), 0, "Database must be empty; never run against business data");
await db.query("CREATE ROLE imesul_vendas_app LOGIN");
for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort()) {
  await db.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"));
}
await db.query(`GRANT SELECT ON sales_sellers, sales_leads, sales_lead_events TO imesul_vendas_app;
  GRANT INSERT, UPDATE ON sales_leads TO imesul_vendas_app;
  GRANT INSERT ON sales_lead_events TO imesul_vendas_app;
  GRANT USAGE ON SEQUENCE sales_leads_id_seq, sales_lead_events_id_seq TO imesul_vendas_app`);
const runtimeUrl = new URL(url);
runtimeUrl.username = "imesul_vendas_app";

let serial = 0;
const makeLead = () => createLead({ unit: "campo-grande", visitorId: `rr-${++serial}`, clientRequestId: `request-${serial}`, quoteSummary: "test" });
const reset = async (sellers) => {
  await db.query("TRUNCATE sales_sellers, sales_leads RESTART IDENTITY CASCADE");
  await db.query("UPDATE commercial_seller_rotation_state SET last_seller_id = NULL");
  for (let i = 0; i < sellers; i++) {
    await db.query("INSERT INTO sales_sellers (name, whatsapp, unit) VALUES ($1, '5567900000000', 'campo-grande')", [`Seller ${i + 1}`]);
  }
};
const check = async (expected, sellers) => {
  const rows = (await db.query("SELECT seller_id, count(*)::int AS n FROM sales_leads GROUP BY seller_id ORDER BY seller_id")).rows;
  assert(rows.every(r => r.seller_id !== null));
  assert.equal(rows.reduce((sum, r) => sum + r.n, 0), expected);
  assert.equal(rows.length, sellers);
  assert(Math.max(...rows.map(r => r.n)) - Math.min(...rows.map(r => r.n)) <= 1);
  const [stats] = (await db.query("SELECT count(*) = count(DISTINCT idempotency_key) AS unique_keys, count(*) = count(DISTINCT lead_code) AS unique_codes FROM sales_leads")).rows;
  assert(stats.unique_keys && stats.unique_codes);
  return rows.map(r => r.n).join("/");
};
const burst = async (instances, countPerInstance, sameKey) => {
  const children = Array.from({ length: instances }, () => fork(new URL("./helpers/rotation-worker.mjs", import.meta.url), [], {
    execArgv: ["--no-warnings", "--loader", new URL("./helpers/rotation-loader.mjs", import.meta.url).href],
    stdio: ["ignore", "ignore", "inherit", "ipc"],
    env: { ...process.env, DATABASE_URL: runtimeUrl.href, DATABASE_POOL_MAX: "3" },
  }));
  try {
    await Promise.all(children.map(child => new Promise((resolve, reject) => {
      child.once("message", resolve); child.once("error", reject);
      child.once("exit", code => { if (code) reject(new Error(`worker exited ${code}`)); });
    })));
    return await Promise.all(children.map((child, index) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("worker timed out")), 60000);
      child.once("message", message => {
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error));
        else {
          try { assert(message.results.every(r => r.ok && r.seller?.id)); resolve(message.results); }
          catch (error) { reject(error); }
        }
      });
      child.send({ count: countPerInstance, prefix: `burst-${++serial}-${index}`, sameKey });
    })));
  } finally { children.forEach(child => child.kill()); }
};

try {
  for (const sellers of [1, 2, 3]) {
    await reset(sellers);
    for (let i = 0; i < 100; i++) assert((await makeLead()).ok);
    console.log(`${sellers} sellers / 100 leads: ${await check(100, sellers)}`);
    if (sellers === 2) { assert((await makeLead()).ok); assert.equal(await check(101, 2), "51/50"); }
    const ids = (await db.query("SELECT seller_id FROM sales_leads ORDER BY id")).rows;
    ids.forEach((r, i) => assert.equal(r.seller_id, String(i % sellers + 1)));
  }
  await reset(3);
  assert.equal((await makeLead()).seller.id, "1");
  await db.query("UPDATE sales_sellers SET active = FALSE WHERE id = 2");
  assert.equal((await makeLead()).seller.id, "3");
  await db.query("UPDATE sales_sellers SET active = FALSE WHERE id = 3");
  assert.equal((await makeLead()).seller.id, "1");
  await db.query("UPDATE sales_sellers SET active = TRUE WHERE id = 2");
  assert.equal((await makeLead()).seller.id, "2");
  await db.query("UPDATE sales_sellers SET active = FALSE");
  const before = (await db.query("SELECT last_seller_id FROM commercial_seller_rotation_state")).rows;
  assert.equal((await makeLead()).code, "NO_ACTIVE_SELLER");
  assert.deepEqual((await db.query("SELECT last_seller_id FROM commercial_seller_rotation_state")).rows, before);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sales_leads")).rows[0].n, 4);
  console.log("disable/reactivate/inactive cursor/no active seller: passed");

  await reset(2);
  // Fail after cursor UPDATE, at COMMIT, to prove lead + cursor both roll back.
  await db.query(`CREATE FUNCTION fail_rotation_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected commit failure'; END $$;
    CREATE CONSTRAINT TRIGGER fail_rotation AFTER UPDATE ON commercial_seller_rotation_state
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_rotation_commit()`);
  assert.equal((await makeLead()).ok, false);
  assert.equal((await db.query("SELECT last_seller_id FROM commercial_seller_rotation_state")).rows[0].last_seller_id, null);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sales_leads")).rows[0].n, 0);
  await db.query("DROP TRIGGER fail_rotation ON commercial_seller_rotation_state; DROP FUNCTION fail_rotation_commit()");
  assert.equal((await makeLead()).seller.id, "1");
  console.log("rollback at COMMIT: passed");

  await reset(2);
  const duplicates = (await burst(4, 25, "same-idempotency-key")).flat();
  assert.equal(new Set(duplicates.map(r => r.leadId)).size, 1);
  assert.equal(duplicates.filter(r => !r.deduped).length, 1);
  assert.equal((await makeLead()).seller.id, "2");
  assert.equal(await check(2, 2), "1/1");
  console.log("100 concurrent requests / same key / 4 processes: 1 lead, 1 turn");

  // Audit failure leaves durable intent, without holding the cursor or losing the lead.
  await reset(2);
  await db.query(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected audit failure'; END $$;
    CREATE TRIGGER fail_audit BEFORE INSERT ON sales_lead_events FOR EACH ROW EXECUTE FUNCTION fail_audit()`);
  assert((await makeLead()).ok);
  assert((await db.query("SELECT rotation_creation_audit FROM sales_leads")).rows[0].rotation_creation_audit);
  await db.query("UPDATE sales_leads SET seller_id = 2");
  await db.query("DROP TRIGGER fail_audit ON sales_lead_events; DROP FUNCTION fail_audit()");
  await Promise.all([flushRotationCreationAudit(), flushRotationCreationAudit()]);
  const events = (await db.query("SELECT event_type, actor_id FROM sales_lead_events ORDER BY id")).rows;
  assert.equal(events.length, 2);
  assert.equal(events.find(e => e.event_type === "SELLER_ASSIGNED").actor_id, "1");
  console.log("audit failure/recovery/concurrent draining/original seller: passed");

  await reset(2);
  const blocker = await db.connect();
  await blocker.query("BEGIN");
  await blocker.query("LOCK TABLE sales_lead_events IN ACCESS EXCLUSIVE MODE");
  const waitingLeads = [makeLead(), makeLead()];
  try {
    const deadline = Date.now() + 5000;
    let committed = 0;
    while (committed < 2 && Date.now() < deadline) {
      committed = (await db.query("SELECT count(*)::int AS n FROM sales_leads")).rows[0].n;
      if (committed < 2) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(committed, 2, "blocked audit must not prevent the next lead from committing");
    assert.equal(await check(2, 2), "1/1");
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    assert((await Promise.all(waitingLeads)).every(r => r.ok));
  }
  console.log("blocked secondary audit: both leads/cursor committed before audit unlock");

  const douradosCursor = (await db.query("SELECT * FROM dourados_alternator_state")).rows;
  const cgCursor = (await db.query("SELECT * FROM commercial_seller_rotation_state")).rows;
  const douradosLead = await createLead({ unit: "dourados", visitorId: "dourados-test", clientRequestId: "dourados-test" });
  assert(douradosLead.ok && douradosLead.seller === null);
  assert.deepEqual((await db.query("SELECT * FROM dourados_alternator_state")).rows, douradosCursor);
  assert.deepEqual((await db.query("SELECT * FROM commercial_seller_rotation_state")).rows, cgCursor);
  console.log("Dourados lead and both cursor states: unchanged behavior");

  for (const instances of [2, 4]) {
    for (let repeat = 1; repeat <= 5; repeat++) {
      await reset(2);
      await burst(instances, 100);
      console.log(`${instances} instances x 100, round ${repeat}: ${await check(instances * 100, 2)}`);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM sales_lead_events")).rows[0].n, instances * 200);
    }
  }
  await reset(3);
  await burst(4, 25);
  console.log(`4 instances / 100 leads / 3 sellers: ${await check(100, 3)}`);
  assert.equal(Number((await db.query("SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()")).rows[0].deadlocks), 0);
  console.log("All real Postgres tests passed; NULL sellers=0, duplicates=0, deadlocks=0");
} finally { await db.end(); }
