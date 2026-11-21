---
title: DynamoDB → PostgreSQL, one flag at a time
org: RichAPI
year: '2026'
summary: Moved the API proxy’s data — usage, quotas, jobs, webhooks, OAuth tokens, provider health — from a DynamoDB single table to PostgreSQL (Supabase) behind a flag-driven dual-write layer with shadow reads, then built the billing, pricing and retention models that a relational store made possible.
outcome: Two sources of truth became one · DynamoDB retired
stack: [Python, PostgreSQL, Supabase, DynamoDB, AWS Lambda]
order: 3
caseStudy: true
---

## Context

RichAPI’s API proxy sits in front of every customer request: it authenticates the key, checks quota, calls the upstream providers, logs usage and bills credits. When I picked this up, that proxy ran on AWS Lambda and kept its state in a **DynamoDB single table** — every record type sharing one table and told apart by its key prefix:

| DynamoDB key pattern | What it held |
| --- | --- |
| `USAGE#{api_key_id}` | one row per API call (90-day TTL) |
| `QUOTA#{api_key_id}#{api_name}` | monthly call counters |
| `API_ACCESS#{api_key_id}` | plan, allowed endpoints, custom limits |
| `JOB#{job_id}`, `WEBHOOK#{job_id}` | async jobs and their callbacks |
| `TOKEN#{token_url}` | cached upstream OAuth tokens |
| `PROVIDER_HEALTH#{name}` | circuit-breaker state per provider |
| `PROVIDER_RATE#…`, `ADMIN_AUDIT#…`, `LAST_RUN#…` | rate windows, audit log, last request |

Meanwhile everything about the *customer* — teams, API keys, credit balances — already lived in **PostgreSQL on Supabase**.

## Why move

Two stores meant two sources of truth for one business. The questions the company actually asked — *what did this team spend this month, on which endpoints, at what margin?* — needed a usage row from DynamoDB joined to a team, a key and a price from Postgres. In DynamoDB that join happens in application code, and anything not shaped like the table’s keys — "all quota counters this month", "all usage for one endpoint" — is a **Scan**. Every new report was a new access pattern to design around.

Moving the proxy’s data into the same Postgres as the accounts makes those questions a `JOIN` and a `GROUP BY`, puts foreign keys and constraints on data that had none, and leaves one backup, one permission model (row-level security) and one place to look.

The constraint: the proxy serves live traffic and bills on every call. **No downtime, and no lost or double-counted usage.**

## Flags, not a flag day

I put both stores behind the existing data-access module and changed **only its internals**. Every caller in the request path — the handler, the rate limiter — kept calling the same functions throughout. Which store those functions touched was decided by five environment variables:

| Flag | Values (default first) |
| --- | --- |
| `DB_WRITE_MODE` | `dynamo_only` · `dual_write` · `supabase_primary` · `supabase_only` |
| `DB_READ_MODE` | `dynamo` · `supabase_with_fallback` · `supabase` |
| `DB_SHADOW_READ` | `false` · `true` — read both, log differences, serve DynamoDB |
| `DB_QUOTA_MODE` | `dynamo` · `supabase` |
| `DB_HEALTH_MODE` | `dynamo` · `supabase` |

The defaults reproduced the old behaviour exactly, so the first deploy carried **zero risk**: new code, same store. From there, each step is a one-line config change, and so is each rollback:

1. Deploy with defaults — nothing changes.
2. `dual_write` — every new write goes to both stores.
3. Backfill history that predates step 2.
4. Shadow reads — read both, log every mismatch, keep serving DynamoDB.
5. Postgres answers reads, falling back to DynamoDB on a miss or error.
6. Move the atomic counters (provider health, then quota) — *switched*, never dual-written.
7. `supabase_only` — DynamoDB writes stop.
8. Remove DynamoDB from the infrastructure template, with the table retained.

## Writes: one store is always the truth

During dual writes, DynamoDB stayed authoritative. A failed Postgres write is logged and swallowed — it must never fail a customer’s request for a store that isn’t serving reads yet:

```python
def log_usage(api_key_id, api_name, status_code, billable, ...):
    if _write_dynamo():
        _dynamo_log_usage(api_key_id, api_name, status_code, billable, ...)
    if _write_pg():
        _pg_write_safe("log_usage", lambda: _pg_log_usage(
            api_key_id, api_name, status_code, billable, ...))

def _pg_write_safe(fn_name, fn):
    """Execute a Postgres write. Swallow errors so DynamoDB remains authoritative."""
    try:
        fn()
    except Exception as exc:
        logger.warning("supabase_write_failed fn=%s err=%s", fn_name, exc)
```

Every swallowed failure leaves a log line, so "how many writes did Postgres miss?" is a query, not a guess — and the idempotent backfill can repair any gaps.

## Reads: prove it before you trust it

Before Postgres answered a single request, **shadow reads** ran every read against both stores and compared the results. DynamoDB returns numbers as `Decimal`, Postgres as floats, so both sides are normalised first; any real difference is logged with both values and the function name, while the customer still gets the DynamoDB answer.

When reads did move, they moved with a safety net: in `supabase_with_fallback` mode a Postgres miss or error falls back to DynamoDB and logs `supabase_read_fallback`. Watching that log go quiet is how you know the backfill is complete.

## The part you can’t dual-write: counters

Most data is safe to write twice. **Counters are not.** Quota checks and the provider circuit breaker are compare-and-increment operations against a single number. Dual-write them and you get *two independent counters* — a customer could use their full monthly quota against each store, and two instances could both decide they are the one allowed to probe a failing provider.

So those operations never ran on both stores. Each had its own flag and **switched over atomically**, after the rest of the data had proven itself. On the Postgres side the quota check is one statement — insert or increment, but only while under the limit:

```sql
INSERT INTO quota (api_key_id, api_name, month, call_count, expires_at)
VALUES ($1, $2, $3, 1, $4)
ON CONFLICT (api_key_id, api_name, month) DO UPDATE
    SET call_count = quota.call_count + 1
    WHERE quota.call_count < $5          -- no row returned ⇒ over quota
RETURNING call_count;
```

No lock, no read-then-write race: the row lock taken by `ON CONFLICT` makes the check and the increment one atomic step, exactly like DynamoDB’s conditional update it replaced.

## A backfill you can run twice

History written before dual writes began was copied by a one-off script designed to be boring:

- **Idempotent.** Every insert is `ON CONFLICT DO NOTHING`, so it is safe to re-run, and safe to run *while* the live service is dual-writing the same rows.
- **Polite to production.** DynamoDB scans are throttled (five pages a second by default) to keep the read capacity the live proxy needs.
- **Rehearsed.** `--count` sizes the job, `--dry-run` validates every transform and prints samples, `--migrate` does the work in batches of 500, and `--verify` compares row counts per table afterwards.
- **On the right connection.** It uses a direct Postgres session, not the transaction pooler, because long-running batch transactions and a pooler don’t mix.

Not everything was copied. Credits were never in DynamoDB — they already lived in a Postgres ledger — and the separate "last run" records were folded into the request body on each usage row instead of getting a table of their own.

The DynamoDB code paths were then deleted outright rather than left behind as a compatibility layer, and once every customer’s data was confirmed in Postgres, the one-off backfill script went too.

## What one database made possible

The migration was the means. These came after, and each was a schema change plus a query rather than a new access pattern:

- **An organization wallet.** Credits moved from each team to an organization above it, so every team in a company spends from one balance — with wallet access restricted to owners.
- **Org-specific pricing.** A per-organization credit price that flows through usage cost, revenue reporting and Stripe top-ups.
- **Usage reporting that survives retention.** A daily rollup (day × team × key × endpoint) is written *before* the 90-day purge of raw usage runs, and the purge refuses to delete any day that hasn’t been rolled up — so the monthly usage email can never disagree with what was deleted.
- **Retention that actually runs.** DynamoDB had expired rows by itself through TTL. After the move, the old `expires_at` columns on jobs and webhooks were still being written but nothing enforced them — a silent behaviour change. A nightly purge with matching indexes now does what the TTL used to.

## Trade-offs and lessons

- **Five flags is a lot of states.** Most combinations are nonsensical (Postgres reads before Postgres writes, for instance). The phases are the only supported path; a guard that rejects invalid combinations at start-up would have been worth adding.
- **Lost guarantees hide in features you didn’t write.** TTL was a DynamoDB feature, not our code, so nothing in our code said "delete this". Listing the store’s *implicit* behaviours — TTL, conditional writes, item size limits — belongs in the migration plan, not in a follow-up.
- **Schema drift is the new risk.** DynamoDB has no schema to drift; Postgres does. Migrations are now numbered, reviewed and applied ahead of the code that needs them.

## Result

- **One source of truth.** Usage, quotas, jobs and webhooks sit next to the teams, keys and credits they belong to; reporting is SQL.
- **No change to any caller in the request path** — the switch happened entirely inside the data layer, and every step had a one-line rollback.
- **DynamoDB retired** from the request path, the code base and the infrastructure template.
- A foundation the billing work builds on: organization wallets, per-org pricing, daily usage rollups and enforced retention.
