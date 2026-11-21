---
title: NestJS → Go, without a big-bang rewrite
org: TexAu
year: '2025–26'
summary: Moved TexAu V3’s backend from a NestJS (TypeScript) monorepo to Go services by freezing two contracts — the Postgres schema and the RabbitMQ message format — so both stacks could run side by side against the same data, with no data migration and no big-bang cutover.
outcome: 30% lower latency · 40% less memory · 2× throughput
stack: [Node.js, NestJS, TypeScript, Go, Gin, RabbitMQ, PostgreSQL, Redis]
order: 1
caseStudy: true
---

## Context

TexAu V3 is a workspace for B2B data enrichment. Users build tables of companies and people, then add columns that enrich, transform, score and sync every row — calls to enrichment APIs, AI prompts, formulas, HTTP requests, CRM sync, webhooks. Running a column over a table is a **job**: one message in, then thousands of rows, each fanning out into outbound calls, with results streaming back into the table while the user watches.

The V3 backend started life in Node.js. I made its first commit in August 2025: a **NestJS monorepo** with a `backend` and a `billing` app, shared libraries for caching, messaging and the API gateway, **Prisma** on PostgreSQL, **RabbitMQ** for jobs and **Redis** for caching. NestJS was the right call for getting a product out — modules, guards, validation and Swagger out of the box, all in TypeScript.

The shape of the workload is what changed the calculation. Most of the time isn’t spent serving HTTP requests; it is spent *running jobs* — holding thousands of in-flight outbound calls, scheduling work across many workspaces, and pushing cell updates to browsers. That is concurrency-heavy, long-lived work, and it is where Go fits better: goroutines are cheap enough to hold one per in-flight call, a single process uses every core, and each pod needs far less memory to do it. So the backend — HTTP API and workflow engine — moved to Go.

## The rule: freeze the contracts, not the code

A rewrite fails when everything has to switch at once. I avoided that by deciding up front which things would **not** change, so that the NestJS and Go services could coexist for as long as it took.

**1. One database, one schema.** The Go services read and write the same PostgreSQL tables that Prisma created — down to Prisma’s quoted PascalCase names. That makes for slightly unusual SQL in Go:

```go
// GORM against the schema Prisma created — same tables, same columns.
query.Joins(`INNER JOIN "TableInstance" ON "TableRow"."tableInstanceId" = "TableInstance".id`).
	Where(`"TableRow"."deletedAt" IS NULL AND "TableInstance"."deletedAt" IS NULL`)
```

…but it meant there was **no data migration at all**. A row written by NestJS could be read by Go a millisecond later, and vice versa. No dual writes, no backfill, no reconciliation job.

**2. One message format.** Jobs already travelled over RabbitMQ: the NestJS backend published `table.run` on the `texau.events` exchange. The Go workflow engine consumes exactly that routing key and exactly that JSON payload:

```ts
// NestJS (before)
interface TableExecutionPayload {
  event_type: 'workflow';
  table_instance_id: string;
  job_id: string;
  organization_id: string;
  user_id: string;
  column_id: string | null;
  row_ids: string[];
  timestamp: string;
}
```

```go
// Go (after) — same wire format, two additive fields
type TableExecutionPayload struct {
	EventType       string   `json:"event_type"`
	TableInstanceID string   `json:"table_instance_id"`
	JobID           string   `json:"job_id"`
	OrganizationID  string   `json:"organization_id"`
	UserID          string   `json:"user_id"`
	WorkspaceID     string   `json:"workspace_id"` // new
	PlanTier        string   `json:"plan_tier"`    // new
	ColumnID        *string  `json:"column_id"`
	RowIDs          []string `json:"row_ids"`
	Timestamp       string   `json:"timestamp"`
}
```

New fields were only ever **added**, and the consumer treats a missing one as "legacy, let it through". A message from the old NestJS producer and one from the new Go producer are both valid, so the producing side could move to Go without the consumer noticing.

<figure>
<div style="overflow-x:auto">
<svg viewBox="0 0 680 380" role="img" aria-labelledby="mig-title" style="min-width:600px;width:100%;height:auto;font-family:inherit">
  <title id="mig-title">NestJS and Go services sharing one database and one message contract during the migration</title>
  <defs>
    <marker id="mig-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" style="fill:var(--muted)"/>
    </marker>
  </defs>
  <g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#mig-arrow)">
    <path d="M300 60 V74 H150 V88"/>
    <path d="M380 60 V74 H530 V88"/>
    <path d="M150 138 V194 H246"/>
    <path d="M530 138 V194 H434"/>
    <path d="M340 218 V274 H416"/>
  </g>
  <g style="stroke:var(--muted);stroke-width:1.5;fill:none;stroke-dasharray:4 4" marker-end="url(#mig-arrow)">
    <path d="M60 138 V326"/>
    <path d="M628 138 V326"/>
    <path d="M510 298 V326"/>
  </g>
  <rect x="285" y="20" width="110" height="40" rx="8" style="fill:var(--surface);stroke:var(--line)"/>
  <text x="340" y="45" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:600">Web app</text>
  <rect x="40" y="90" width="220" height="48" rx="8" style="fill:var(--surface);stroke:var(--line);stroke-dasharray:5 3"/>
  <text x="150" y="111" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:600">NestJS API (retiring)</text>
  <text x="150" y="128" text-anchor="middle" style="fill:var(--muted);font-size:11px">TypeScript · Prisma</text>
  <rect x="420" y="90" width="220" height="48" rx="8" style="fill:var(--surface);stroke:var(--accent)"/>
  <text x="530" y="111" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:600">Go API (Gin)</text>
  <text x="530" y="128" text-anchor="middle" style="fill:var(--muted);font-size:11px">GORM · SSE</text>
  <rect x="250" y="170" width="180" height="48" rx="8" style="fill:var(--surface);stroke:var(--accent)"/>
  <text x="340" y="191" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:600">RabbitMQ</text>
  <text x="340" y="208" text-anchor="middle" style="fill:var(--accent);font-size:11px;font-family:var(--font-mono)">texau.events · table.run</text>
  <rect x="420" y="250" width="180" height="48" rx="8" style="fill:var(--surface);stroke:var(--accent)"/>
  <text x="510" y="271" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:600">Go workflow engine</text>
  <text x="510" y="288" text-anchor="middle" style="fill:var(--muted);font-size:11px">fair dispatcher · DAG executor</text>
  <rect x="40" y="328" width="600" height="40" rx="8" style="fill:var(--surface);stroke:var(--accent)"/>
  <text x="340" y="353" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:600">PostgreSQL <tspan style="fill:var(--muted);font-weight:400">— one schema, read and written by both stacks</tspan></text>
</svg>
</div>
<figcaption style="margin-top:0.5rem;font-size:0.875rem;color:var(--muted)">During the migration both stacks spoke the same two contracts — the message on <code>table.run</code> and the Postgres schema — so either side could be swapped without the other noticing.</figcaption>
</figure>

With those two contracts fixed, the migration became a sequence of small moves — feature areas ported to Go one at a time, against the same data, while the NestJS version kept serving until it wasn’t needed. The last change to the NestJS V3 app shipped in May 2026.

## What I built on the Go side

Porting wasn’t only translation. Several things were rebuilt properly because Go made them cheap to do well.

### Fair scheduling across workspaces

In a shared queue, one workspace that kicks off a 50,000-row run can starve every other customer behind it. I replaced the plain consumer with a **weighted fair dispatcher**:

- Jobs are buffered **per workspace**, not in one FIFO.
- Each workspace has a *virtual time* that advances by 1 every time one of its jobs is dispatched.
- A **min-heap** orders workspaces by `virtualTime / planWeight`; the dispatcher always takes from the lowest score. Equal weights give round-robin; raising a plan’s weight gives it proportionally more turns. The weights are configuration, not code.
- Jobs of **100 rows or fewer get a small boost**, so a quick 20-row run isn’t stuck behind a giant one from the same tier (head-of-line blocking).

```go
for wsID, state := range d.states {
	if len(state.pending) == 0 {
		continue
	}
	rows := len(state.pending[0].EventPayload.RowIDs)
	weight := planScoreForPriority(d.planPriority, state.planTier, rows) // small-job boost
	h = append(h, &schedulingEntry{workspaceID: wsID, score: state.virtualTime / float64(weight)})
}
heap.Init(&h) // lowest score is dispatched first
```

Each pick also has to pass a **per-workspace concurrency cap** tied to the plan (for example 3, 5 or 10 jobs at once). The counter lives in Redis behind two small Lua scripts — acquire-if-below-limit and release-floored-at-zero — so the cap holds across every pod, not just one process. The key carries a one-hour TTL as a safety net: if a pod dies holding slots, the workspace unblocks itself. If Redis is unreachable, the limiter lets jobs through rather than deadlocking the queue.

The dispatch loop wakes on two signals: a new job arriving, or a slot being released — with a 50 ms ticker as a backstop. The feature shipped with unit, integration and end-to-end tests that assert the fairness properties directly, such as "a higher-weighted plan gets the majority of the first dispatches under concurrent load".

### Live cell updates over Server-Sent Events

Users watch their tables fill in. The Go API exposes `GET /tables/:tableId/subscribe` as an **SSE** stream: it checks the table belongs to the caller’s workspace, flushes headers immediately, streams cell updates as jobs write them, and closes long-lived connections on a timeout so idle tabs can’t leak memory — the browser’s `EventSource` reconnects on its own. SSE was a better fit than WebSockets here: updates only flow one way, and it is plain HTTP through every proxy.

### Surviving broker restarts

A workflow engine that dies when RabbitMQ blips is not production-ready. I added **reconnect-on-disconnect** to the Go RabbitMQ client and fixed dead-lettering so failed messages land in a **dead-letter queue** for inspection. The client has since been hardened further: when several consumers notice a dropped connection at the same moment, they wait on *one* shared reconnect attempt instead of stampeding the broker, and channels are handed out under a lock so nothing races a reconnect.

### And the rest of the surface

Outgoing webhooks with per-plan limits, the billing workflow with idempotency keys and auto top-up, an enrichment cache, workbook and view APIs, usage tracking and lifecycle emails — each ported or built against the same shared schema.

## Trade-offs

- **Living with Prisma’s naming in Go.** Quoted PascalCase tables make the Go SQL noisier. In exchange there was zero data migration and the two stacks could share every row. Renaming tables is a cheap, separate project once only one stack is left.
- **Two stacks at once is a cost.** For a while, a fix sometimes had to land in both. Keeping that window short — moving a whole feature area at a time — mattered more than moving fast.
- **Fail-open concurrency limits.** During a Redis outage a workspace could briefly run more jobs than its plan allows. That is a better failure than a stalled queue for every customer.
- **Not everything needed Go.** TypeScript stayed where it is strongest — the frontend, the browser extension, and the published n8n community node.

## Result

- **30% lower latency, 40% less memory and 2× throughput** across the three applications that moved.
- **No data migration and no big-bang cutover** — the old and new services ran against the same data until the NestJS app had nothing left to do.
- A job system that is **fair by construction**: one large run can no longer starve every other workspace.
- Real-time table updates and a broker client that recovers on its own.
