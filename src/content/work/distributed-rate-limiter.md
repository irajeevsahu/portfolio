---
title: Distributed rate limiter & provider failover
org: RichAPI
year: '2026'
summary: Two layers of Redis rate limiting — a per-organization request rate, and a per-provider budget with a fair share for each customer — checked atomically in one Lua script, with cooldowns on upstream 429s and fall-through across a 13-provider waterfall.
outcome: One customer’s burst can no longer drain a provider for everyone else
stack: [Redis, Lua, GCRA, Python, FastAPI]
order: 2
caseStudy: true
---

## Context

RichAPI is a data-enrichment API. A customer makes one call — "find the work email for this person" — and behind it sits a **waterfall** of third-party data providers: try the first, and if it has no answer or is unavailable, fall through to the next. The platform sustains 150–300 requests per second across about 80 endpoints.

Every one of those providers sells us a fixed budget: so many calls per second, per minute, per day. That budget is shared by **all** of our customers. The risk was simple to state:

- One customer fires 1,000 requests in a second. All 1,000 land on the same provider.
- The provider starts returning `429 Too Many Requests`.
- Every *other* customer using that provider now fails too — and we keep hammering it.

There was a second, quieter problem. The per-customer request rate had been enforced per **API key**, so a customer with ten keys silently got ten times the throughput they paid for.

## Two limits, two different questions

I split rate limiting into two layers, because they answer different questions and fail in different ways.

| | Layer 1 — customer rate | Layer 2 — provider budget |
| --- | --- | --- |
| Question | How fast may this organization call **us**? | How fast may we call **provider X**, and how much of that is this customer’s share? |
| Scope | One counter per organization, shared by every key and team in it | Per provider (and per provider account), plus a per-customer slot inside it |
| Limit comes from | The org’s pricing tier (requests/sec × burst multiplier), editable without a deploy | The provider’s contract, from endpoint config |
| On denial | `429` to the customer | Skip to the next provider, or wait a few milliseconds |

Moving layer 1 from the API key to the organization closed the "more keys, more throughput" loophole: the allowance belongs to the org’s wallet and is divided among its keys, not copied to each one.

<figure>
<div style="overflow-x:auto">
<svg viewBox="0 0 680 470" role="img" aria-labelledby="rl-title" style="min-width:600px;width:100%;height:auto;font-family:inherit">
  <title id="rl-title">Request flow through the two rate-limit layers</title>
  <defs>
    <marker id="rl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" style="fill:var(--muted)"/>
    </marker>
  </defs>
  <g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#rl-arrow)">
    <path d="M340 60 V92"/>
    <path d="M340 150 V182"/>
    <path d="M135 330 V362"/>
    <path d="M340 330 V362"/>
    <path d="M545 330 V362"/>
    <path d="M490 121 H530"/>
  </g>
  <rect x="240" y="20" width="200" height="40" rx="8" style="fill:var(--surface);stroke:var(--line)"/>
  <text x="340" y="45" text-anchor="middle" style="fill:var(--fg);font-size:14px;font-weight:600">Customer request</text>
  <rect x="190" y="94" width="300" height="56" rx="8" style="fill:var(--surface);stroke:var(--accent)"/>
  <text x="340" y="117" text-anchor="middle" style="fill:var(--fg);font-size:14px;font-weight:600">Layer 1 · organization rate</text>
  <text x="340" y="137" text-anchor="middle" style="fill:var(--muted);font-size:12px">req/s × burst, shared by all of the org’s keys</text>
  <text x="536" y="117" style="fill:var(--muted);font-size:12px">over the limit</text>
  <text x="536" y="133" style="fill:var(--muted);font-size:12px">→ 429 to customer</text>
  <rect x="40" y="184" width="600" height="146" rx="10" style="fill:var(--surface);stroke:var(--accent)"/>
  <text x="340" y="210" text-anchor="middle" style="fill:var(--fg);font-size:14px;font-weight:600">Layer 2 · one Lua script per provider attempt</text>
  <g style="font-size:12px">
    <rect x="56" y="226" width="104" height="44" rx="6" style="fill:var(--bg);stroke:var(--line)"/>
    <text x="108" y="245" text-anchor="middle" style="fill:var(--fg)">1 · cooldown?</text>
    <text x="108" y="261" text-anchor="middle" style="fill:var(--muted);font-size:11px">after a 429</text>
    <rect x="172" y="226" width="104" height="44" rx="6" style="fill:var(--bg);stroke:var(--line)"/>
    <text x="224" y="245" text-anchor="middle" style="fill:var(--fg)">2 · provider /s</text>
    <text x="224" y="261" text-anchor="middle" style="fill:var(--muted);font-size:11px">GCRA</text>
    <rect x="288" y="226" width="104" height="44" rx="6" style="fill:var(--bg);stroke:var(--line)"/>
    <text x="340" y="245" text-anchor="middle" style="fill:var(--fg)">3 · provider /min</text>
    <text x="340" y="261" text-anchor="middle" style="fill:var(--muted);font-size:11px">GCRA</text>
    <rect x="404" y="226" width="104" height="44" rx="6" style="fill:var(--bg);stroke:var(--line)"/>
    <text x="456" y="245" text-anchor="middle" style="fill:var(--fg)">4 · provider /day</text>
    <text x="456" y="261" text-anchor="middle" style="fill:var(--muted);font-size:11px">UTC-day counter</text>
    <rect x="520" y="226" width="104" height="44" rx="6" style="fill:var(--bg);stroke:var(--line)"/>
    <text x="572" y="245" text-anchor="middle" style="fill:var(--fg)">5 · customer share</text>
    <text x="572" y="261" text-anchor="middle" style="fill:var(--muted);font-size:11px">limit × tier share</text>
  </g>
  <text x="340" y="304" text-anchor="middle" style="fill:var(--accent);font-size:12px;font-family:var(--font-mono)">all pass → write every key · any fails → write nothing</text>
  <g style="font-size:12px">
    <rect x="40" y="364" width="190" height="62" rx="8" style="fill:var(--surface);stroke:var(--line)"/>
    <text x="135" y="388" text-anchor="middle" style="fill:var(--fg);font-weight:600">Allowed</text>
    <text x="135" y="406" text-anchor="middle" style="fill:var(--muted)">call the provider</text>
    <rect x="245" y="364" width="190" height="62" rx="8" style="fill:var(--surface);stroke:var(--line)"/>
    <text x="340" y="388" text-anchor="middle" style="fill:var(--fg);font-weight:600">Short denial (/s, /min)</text>
    <text x="340" y="406" text-anchor="middle" style="fill:var(--muted)">wait retry_after, bounded</text>
    <rect x="450" y="364" width="190" height="62" rx="8" style="fill:var(--surface);stroke:var(--line)"/>
    <text x="545" y="388" text-anchor="middle" style="fill:var(--fg);font-weight:600">Long denial (/day, cooldown)</text>
    <text x="545" y="406" text-anchor="middle" style="fill:var(--muted)">skip to the next provider</text>
  </g>
  <text x="135" y="452" text-anchor="middle" style="fill:var(--muted);font-size:11px">provider 429 → cooldown from Retry-After</text>
</svg>
</div>
<figcaption style="margin-top:0.5rem;font-size:0.875rem;color:var(--muted)">Every provider attempt in the waterfall runs layer 2 before any HTTP call is made.</figcaption>
</figure>

## Why GCRA instead of a counter

The obvious implementation is a counter per window: `INCR provider:second:1732190400`, deny when it passes the limit. It is easy, but a fixed window lets a client send a full window’s worth at the end of one second and another full window at the start of the next — double the rate across the boundary. And it can only tell a denied caller "try later", not *when*.

I used **GCRA** (the Generic Cell Rate Algorithm). It behaves exactly like a token bucket, but stores a single number per key — the *theoretical arrival time* (TAT) at which the bucket will next be empty — so there is no background refill and no per-token bookkeeping:

```lua
-- KEYS[1] = bucket key
-- ARGV    = now_ms, limit, window_ms, burst
local now, limit, window, burst =
  tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4])

local interval   = math.max(1, math.floor(window / limit)) -- ms per request
local tat        = tonumber(redis.call('GET', KEYS[1]) or now)
local allowed_at = tat - burst * interval

if now < allowed_at then
  return {0, allowed_at - now}             -- denied: retry in exactly N ms
end

local new_tat = math.max(now, tat) + interval
redis.call('SET', KEYS[1], new_tat, 'PX', new_tat - now) -- expires once idle
return {1, 0}
```

Two properties fall out of this for free. The key expires by itself once the bucket is full again, so idle providers cost no memory. And a denial comes with an exact `retry_after` in milliseconds — which turned out to matter more than anything else (see below).

## One script, all checks, all-or-nothing

The production script runs five checks in order — cooldown, provider per-second, provider per-minute, provider per-day, then the customer’s share — and **only writes state once every check has passed**. Because nothing is mutated until the end, a request denied at step 5 never consumed a slot at steps 2–4. Running it as a single Lua script makes the whole decision atomic across every API instance without a lock.

The customer’s share is derived, not configured: `ceil(provider_limit × tier_share)`, never below one. A higher pricing tier buys a larger slice of each provider’s budget, and tier edits reach the hot path without a deploy. The check order is deliberate too — when the provider itself is saturated, the denial says so, rather than blaming the customer’s share.

Every denial returns a reason (`per_second_exceeded`, `per_customer_minute_exceeded`, `provider_cooldown`, …), which the waterfall writes into the request’s execution log as `skipped_rate_limited` — so it is always visible why a provider was skipped.

## When the answer is "no"

A rate-limit denial is only useful if the caller does something sensible with it.

- **Long denials skip.** A per-day cap or a provider cooldown lifts in minutes or hours, so the waterfall moves straight on to the next provider. That is the point of having a waterfall.
- **Short denials wait — carefully.** A customer sending 60 req/s at a provider that allows 50 is inside their own plan; those extra 10 requests would succeed a few milliseconds later. Failing them turns a 20 ms wait into a failed call. Since GCRA already returns the exact wait, holding is a sleep of known length, not a poll. Three guards keep it from becoming its own outage:
  - **Bounded** by a per-endpoint maximum and by the request’s own deadline.
  - **Capped** — on the threaded path a non-blocking semaphore limits how many requests may sleep at once, so a slow provider can’t starve the worker pool. If no hold slot is free, the request doesn’t queue for one; it takes the denial and falls through.
  - **Jittered** by up to 25%, so every waiter denied in the same instant doesn’t wake in the same instant and collide again.
- **Upstream 429s become cooldowns.** If a provider returns 429 anyway, a second Lua script sets a cooldown from its `Retry-After` header (capped at 15 minutes, and never shortening an existing one). Check 1 then skips that provider until it recovers, instead of retrying into it.

Every outbound call goes through a single seam that records the attempt in a **provider ledger** — outcome, latency (p50/p95) and cost — which is what tells us which providers are healthy and what each enrichment actually costs across the 13-provider waterfall.

## Failing open, or closed — on purpose

Redis is a dependency, so each limiter had to decide what happens when Redis is unreachable. They don’t all make the same choice, and that is intentional:

| Limiter | When Redis is down | Why |
| --- | --- | --- |
| Organization rate (layer 1) | **Open** — let the request through | Paying customers; nothing billable is decided here |
| Provider budget, live requests | **Open**, falling back to a coarser Postgres window | Better to risk a provider 429 than to 503 the customer |
| Provider budget, async jobs | **Closed** — re-queue the job | A job can safely run a minute later |
| Free public tier (per IP) | **Closed** | Failing open would mean uncapped spend on paid providers |
| Credits | **Closed** | That is billing |

Rate limiting here is a fairness and safety control, not a billing control — credits are. Keeping those two concerns separate is what made "fail open" a safe default for most of it.

## Trade-offs and what’s next

- **The org layer still uses a fixed one-second window.** It reproduces the behaviour of the API-gateway usage plans it replaced, and the boundary burst is bounded by the tier’s burst multiplier. Moving it to GCRA is a small change now that the provider layer has proven the pattern.
- **Time comes from the caller.** Instances pass `now` into the script. Clock skew between instances can shift a decision by a few milliseconds; reading Redis `TIME` inside the script would remove that.
- **Limits are static.** The next step is adapting a provider’s limit from its own 429s rather than relying only on cooldowns.

## Result

- One customer’s burst can no longer drain a shared provider budget for everyone else — each customer is held to their tier’s share of it.
- Requests that are inside a customer’s plan wait milliseconds instead of failing.
- Providers that push back are rested instead of hammered, and the waterfall routes around them.
- Throughput now follows the organization’s plan, not the number of API keys it creates.
- Tier limits and shares are rows in a table, changed from the admin panel without a deploy.
