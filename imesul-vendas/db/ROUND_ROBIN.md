# Campo Grande: continuous round robin

## Update: single server-side function (migrations 008-009)

The critical region described below (lock, dedup, seller pick, insert, cursor advance) now runs
inside one PL/pgSQL function, `campo_grande_create_lead` (`db/migrations/008_campo_grande_create_lead_function.sql`),
called once per lead via `Backend.js/sellerRotationStore.js#createCampoGrandeLead`. This replaced
the previous JS-orchestrated version (lock statement + pick statement + insert-and-advance
statement = ~5 Node<->Supabase round-trips) with a single round-trip. `SECURITY INVOKER` (the
function runs with the caller's own privileges, `imesul_vendas_app` - never elevated); no new
table grants needed, only `EXECUTE` on the function (migration 008 grants it conditionally when
the role exists, migration 009 then revokes the EXECUTE that Supabase's default privileges had
also granted to `anon`/`authenticated`/`service_role` - same class of issue already seen with
table grants in migration 007).

Inside the function, each SQL command gets its own fresh MVCC snapshot under READ COMMITTED -
unlike a single multi-CTE statement (which shares one snapshot fixed at the start), this correctly
lets the post-lock dedup recheck see any commit that happened while waiting for the cursor lock,
without any network round-trip between steps. `Backend.js/db.js#withTransaction` is no longer used
for Campo Grande at all - the function call itself is atomic (implicit transaction), so `createLead`
calls it via the plain pooled `query()`, not a dedicated client.

Measured on `imesul-vendas-test` (Transaction Pooler): 1x100, 2x100 and 4x100 concurrent leads (100,
200 and 400 total requests) all completed with 0% error, 0 `seller_id NULL`, 0 duplicates, 0
deadlocks, and perfectly even distribution between the 2 active test sellers - a large improvement
over the previous JS-orchestrated version (which degraded past ~60 truly-simultaneous requests
because of accumulated round-trip latency under the same global lock). The rest of this document
(business rules, transaction boundary reasoning, audit-after-commit, verification harness) still
applies conceptually; only the mechanism moved server-side.

Only `unit = campo-grande` uses `commercial_seller_rotation_state`. Active sellers
are ordered by bigint ID, advancing after `last_seller_id` and wrapping at the end.
Disabling or deleting the last seller does not erase the cursor. Busy status,
open leads and `last_assigned_at` do not participate. Existing unscoped legacy
requests and Dourados keep their previous behavior.

## Transaction boundary

Payload normalization and the initial duplicate lookup happen before BEGIN.
Inside the transaction: lock the unit row, recheck idempotency, select an active
seller, INSERT the lead (with durable audit intent), advance the cursor, COMMIT.
Savepoints only protect lead-code/idempotency unique-conflict handling. No events,
network calls or retry sleeps run while holding this cursor. Cursor advancement
happens only after a successful INSERT. Failed commit rolls back both.

No active seller returns `NO_ACTIVE_SELLER` without inserting a lead. Missing
cursor/migration fails explicitly rather than switching algorithms. The stable
clientRequestId remains the idempotency mechanism; the pre-existing 60-second
fallback for requests without that key is unchanged.

## Audit after commit

`rotation_creation_audit` stores original seller/flow/origin in the lead INSERT.
`flushRotationCreationAudit()` then materializes LEAD_CREATED and SELLER_ASSIGNED
and clears the intent atomically, in batches of 25. Event timestamps use the
lead's creation timestamp. A reassignment before replay cannot change the original
seller recorded in this intent. Only the audit queue uses SKIP LOCKED.

Any creation/retry for Campo Grande drains pending work. If the process stops
after commit or event insertion fails, the durable intent survives. With no later
traffic, it remains pending until the same helper is run by a controlled server
maintenance process. No cron/deploy is created in this change. Monitor with:

```sql
SELECT count(*) AS pending, min(created_at) AS oldest
FROM sales_leads
WHERE unit = 'campo-grande' AND rotation_creation_audit IS NOT NULL;
```

## Deployment prerequisites (not executed remotely)

Apply migration 006 with the migration owner before enabling this application
version. It seeds a null cursor and does not backfill/change existing leads.
It grants SELECT/UPDATE on the RLS-protected cursor only to the existing
`imesul_vendas_app` role. If that role is created later, review/apply
`roles/grant_rotation_runtime.sql` after the existing runtime-role script.
No pool sizes, timeouts, dependencies, Dourados tables or settings change.

Queries use one transaction connection, no session locks/settings and no named
prepared statements, compatible with Transaction Pooler. Local concurrency tests
do not prove the latency/capacity of a remote Supabase deployment.

## Verification

Use an empty, disposable LOCAL database named `imesul_rotation_test`. The test
refuses other hosts/names and nonempty databases. It creates a runtime role in
the isolated cluster; use a disposable cluster rather than a shared service.

```powershell
$env:DATABASE_URL='postgresql://rotation_test@127.0.0.1:55439/imesul_rotation_test?sslmode=disable'
node --no-warnings --loader ./test/helpers/rotation-loader.mjs ./test/rotationPostgres.mjs
```

The harness calls the actual createLead module in independent Node processes with
separate pools of 3. It checks 1/2/3 sellers, exact cycling, inactive/reactivated
sellers, no active seller, 100 identical keys, deferred COMMIT failure, audit
failure/replay, audit lock isolation, Dourados, 2x100 and 4x100 (five rounds each),
and 100 leads/3 sellers. Fairness is measured over committed unique leads with a
fixed active roster; changing the roster starts a different distribution interval.
