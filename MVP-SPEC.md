# Makoons Command Center — MVP Spec

> **Audience:** Cursor agents implementing the first shippable slice.
> **Owner:** Joseph Ross
> **Nature:** INTERNAL personal ops board — **not** Viselle product UI.
> **Date:** 2026-08-22

---

## 1. What this is

**Makoons Command Center** is Joseph Ross's personal operations board: a single place to see what needs attention today, this week, and this month across eng, marketing, sales, support, books, and COO/personal work.

- It is **internal** and single-user. It is **not** Viselle multi-tenant product UI, not a customer-facing dashboard, and not a replacement for Linear/Stripe/Canva/etc.
- **Agents push thin cards** into the board via **MCP tools**. Joseph acts on cards flagged `needsJoseph`.
- Default path: open **Home → Needs Joseph**, then **Today**, clear blockers, then horizons and function sections.
- Cards stay thin: title, owner, cadence, status, next step, optional link/due date/tags/source agent. No heavy workflows, no charts, no auto-posting.

**Core loop**

1. Agents (or seed scripts) upsert cards via MCP / local DB.
2. Joseph opens the board, filters **Needs Joseph** and **Today**.
3. Joseph acts externally (approve post, take a call, pull a PR, log into Stripe), then marks complete / updates next step / flags blockers.
4. Agents refresh card state as work progresses.

---

## 2. Success criteria

MVP is done when **all** of the following are true:

| # | Criterion |
|---|-----------|
| 1 | Home shows Needs Joseph and Today prominently (default landing). |
| 2 | Horizon navigation: Today / Week / Month tabs. |
| 3 | Function sections: eng / marketing / sales / support / books / coo. |
| 4 | MCP: list_cards, upsert_card, complete_card, flag_blocker, get_needs_joseph. |
| 5 | SQLite seeded with at least 12 cards including needsJoseph flags. |
| 6 | `npm run dev` boots the Next.js App Router app with Tailwind/shadcn UI and readable cards. |
| 7 | Locked TypeScript CommandCard schema shared by UI, seed, and MCP. |
| 8 | Trial card references viselle.net/get-started code BETA due 2026-10-31. |

---

## 3. Non-goals

Explicitly out of MVP (do not build):

- Viselle multi-tenant product UI, auth for customers, or org switching
- Social auto-post, SMS, Buffer, or any scheduled publishing pipeline
- Stripe mutations (refunds, invoice create/update); login/link + status cards only
- Full Linear sync / two-way issue mirroring
- PR merge bot, CI auto-merge, or GitHub write automation
- Analytics charts, dashboards, or KPI graphs
- Mobile-native apps, push notifications, email digests
- Role-based multi-user ACLs (single operator: Joseph)

---

## 4. Information architecture (IA)

### 4.1 Home

Default route `/` (or `/home`):

- **Needs Joseph** — cards where needsJoseph is true and status is not done (sort: blocked, ready, open; then dueDate).
- **Today** — cards due today or cadence daily and not done; include open blockers.
- **Blockers** strip — status blocked across functions, with nextStep visible.

### 4.2 Horizons

Tabs or segmented control:

| Tab | Rule of thumb |
|-----|----------------|
| **Today** | Daily cadence + due today + urgent blockers |
| **Week** | Weekly cadence + due within 7 days |
| **Month** | Monthly cadence + due within ~30 days / once with monthly horizon |

Cards may appear in more than one view if rules overlap; prefer listing once under the tightest matching horizon.

### 4.3 Function sections and card types

#### eng

- Staging PRs awaiting review / merge decision
- QA pass/fail summaries (thin card pointing to report link)
- BEA blockers (build/env/access)
- **joseph-pick**: visible eng work that stays not started until Joseph explicitly pulls it (needsJoseph true until he starts)

#### marketing

- **Sunday packet** (weekly prep)
- Weekday content **drafts**
- **Saturday engage** reminder
- Post / Canva items that need **Joseph yes** (needsJoseph)

#### sales

- **BETA** trials (link get-started + code)
- 15-min setup calls
- Mixer follow-ups
- Chamber prep

#### support

- Open Help tickets
- New Linear filings (link only; no full sync)
- Ship-date or major-feature decisions requiring Joseph yes

#### books

- Failed charges
- Invoice gaps
- Stripe login / pk_test / cash blockers (Joseph only for cash/Stripe access issues)

#### coo

- Personal todos
- Cross-function coordination cards (owner may be coo even if tags mention other functions)

---

## 5. Locked TypeScript CommandCard schema

This schema is **locked for MVP**. Share it from a single module (e.g. `src/lib/schema.ts`). MCP, seed, and UI must all use it.

```ts
export type Cadence = 'daily' | 'weekly' | 'monthly' | 'once';
export type CardStatus = 'open' | 'ready' | 'blocked' | 'done';
export type FunctionOwner =
  | '"eng"'
  | '"marketing"'
  | '"sales"'
  | '"support"'
  | '"books"'
  | '"coo"';

export interface CommandCard {
  /** Stable unique id (uuid or slug). */
  id: string;
  /** Short human title. */
  title: string;
  /** Function lane. */
  owner: FunctionOwner;
  /** Planning horizon / recurrence intent. */
  cadence: Cadence;
  /** Workflow state. */
  status: CardStatus;
  /** When true, surfaces on Home → Needs Joseph. */
  needsJoseph: boolean;
  /** Concrete next action (one line preferred). */
  nextStep: string;
  /** Optional deep link (PR, Linear, Canva, Stripe, get-started, etc.). */
  link?: string;
  /** ISO date YYYY-MM-DD when relevant. */
  dueDate?: string;
  /** Free-form labels, e.g. ['joseph-pick', 'BETA', 'qa']. */
  tags?: string[];
  /** Which agent last wrote the card, if any. */
  sourceAgent?: string;
  /** ISO-8601 timestamps. */
  updatedAt: string;
  createdAt: string;
}
```

**Status meanings**

| Status | Meaning |
|--------|---------|
| open | Known work; not ready for Joseph yet (or waiting on agent prep) |
| ready | Ready for Joseph / operator action |
| blocked | Cannot proceed; nextStep should say what unblocks |
| done | Complete; hide from Needs Joseph / Today defaults |

---

## 6. MCP tools

Expose an MCP server (SDK) that agents can call. Persist to the same SQLite DB the UI reads.

### list_cards

**Args (all optional filters):**

| Arg | Type | Description |
|-----|------|-------------|
| owner | FunctionOwner | Filter by function |
| status | CardStatus | Filter by status |
| cadence | Cadence | Filter by cadence |
| needsJoseph | boolean | Filter Needs Joseph |
| tag | string | Match if tags contains value |
| includeDone | boolean | Default false |

**Returns:** CommandCard[] (newest updatedAt first unless filtered).

### upsert_card

**Args:**

| Arg | Type | Description |
|-----|------|-------------|
| card | Partial CommandCard plus required id, title, owner, cadence, status, needsJoseph, nextStep | Create or update by id. Server sets createdAt on insert; always refreshes updatedAt. |

**Returns:** full CommandCard.

### complete_card

**Args:**

| Arg | Type | Description |
|-----|------|-------------|
| id | string | Card id |
| note | string? | Optional completion note |

**Behavior:** set status done, needsJoseph false, bump updatedAt.

**Returns:** updated CommandCard.

### flag_blocker

**Args:**

| Arg | Type | Description |
|-----|------|-------------|
| id | string | Card id |
| reason | string | Becomes / updates nextStep with blocker framing |
| needsJoseph | boolean? | Default true |

**Behavior:** set status blocked, set needsJoseph (default true), set nextStep from reason.

**Returns:** updated CommandCard.

### get_needs_joseph

**Args:** none (optional owner filter allowed).

**Returns:** CommandCard[] where needsJoseph is true and status is not done, sorted blocked then ready then open, then dueDate ascending (nulls last).

---

## 7. UI ASCII wireframe (desktop)

```
+------------------------------------------------------------------------------+
|  Makoons Command Center                                          [Joseph]    |
+--------------+---------------------------------------------------------------+
|              |  HOME                                                         |
|  Home     *  |  +- Needs Joseph -------------------------------------------+ |
|              |  |  [blocked] Stripe login / pk_test — books                 | |
|  Horizons    |  |  [ready] Approve Saturday Canva post — marketing           | |
|  · Today     |  |  [ready] joseph-pick: staging PR #42 — eng                 | |
|  · Week      |  |  [open] Approve mixer follow-up DM — sales                 | |
|  · Month     |  +------------------------------------------------------------+ |
|              |  +- Today --------------------------------------------------+ |
|  Functions   |  |  eng · marketing · sales · support · books · coo          | |
|  · eng       |  |  (cards for daily / due today)                            | |
|  · marketing |  +------------------------------------------------------------+ |
|  · sales     |  +- Blockers -----------------------------------------------+ |
|  · support   |  |  BEA access · invoice gap · ship-date yes                  | |
|  · books     |  +------------------------------------------------------------+ |
|  · coo       |                                                               |
|              |  Main list (when a function or horizon selected):              |
|  ----------- |  +- card --------------------------------------------------+ |
|  MCP status  |  | title                          owner · cadence · status  | |
|  seed: ok    |  | nextStep…                                                | |
|              |  | link · due · tags · needsJoseph                          | |
|              |  +------------------------------------------------------------+ |
+--------------+---------------------------------------------------------------+
```

**UI notes**

- Sidebar: Home, horizons, function filters.
- Main: Needs Joseph + Today on Home; elsewhere a filtered card list.
- Card chrome: status chip, needsJoseph badge, nextStep, optional link button.
- No charts. Prefer dense, scannable lists.

---

## 8. Seed data (12 cards)

Seed SQLite on first boot (or via seed script). Timestamps may be now at seed time; due dates as specified.

| # | id (suggested) | title | owner | cadence | status | needsJoseph | nextStep | link / due / tags |
|---|----------------|-------|-------|---------|--------|-------------|----------|-------------------|
| 1 | eng-staging-pr-42 | Review staging PR #42 | eng | once | ready | true | Pull joseph-pick and review diff | tags: joseph-pick, pr |
| 2 | eng-qa-fail-checkout | QA fail: checkout edge case | eng | daily | blocked | true | Unblock BEA / re-run QA after fix | tags: qa, bea |
| 3 | eng-bea-blocker | BEA env access blocker | eng | once | blocked | true | Restore BEA credentials for CI | tags: bea |
| 4 | mkt-sunday-packet | Sunday marketing packet | marketing | weekly | open | false | Assemble drafts for Joseph review Sunday | tags: packet |
| 5 | mkt-weekday-drafts | Weekday content drafts | marketing | daily | open | false | Agents draft; queue for Joseph only if posting | |
| 6 | mkt-saturday-engage | Saturday engage + Canva yes | marketing | weekly | ready | true | Joseph approve post + Canva only | tags: canva, post |
| 7 | sales-beta-trial | BETA trial: get-started | sales | once | ready | true | Share viselle.net/get-started code BETA | link: https://viselle.net/get-started; dueDate: 2026-10-31; tags: BETA, trial |
| 8 | sales-15min-setup | 15-min setup call | sales | weekly | ready | true | Joseph join / approve setup call | tags: setup |
| 9 | sales-mixer-followup | Mixer follow-up DM/email | sales | weekly | open | true | Approve follow-up DM/email copy | tags: mixer |
| 10 | sales-chamber-prep | Chamber prep | sales | monthly | open | false | Prep materials before Chamber event | tags: chamber |
| 11 | sup-ship-date-yes | Ship-date / major-feature yes | support | once | ready | true | Joseph yes on ship date or major feature | tags: ship, major |
| 12 | books-stripe-pktest | Stripe login / pk_test / failed charge | books | daily | blocked | true | Joseph Stripe login; inspect failed charge + invoice gap | tags: stripe, pk_test, cash |

**Canonical requirement:** seed exactly these 12 cards. UI must still show the **coo** function section (empty until agents upsert; empty state OK).

**Trial card hard requirements**

- Link includes viselle.net/get-started
- Code BETA
- dueDate: 2026-10-31

**needsJoseph true in seed:** cards 1, 2, 3, 6, 7, 8, 9, 11, 12.

---

## 9. Tech stack

| Layer | Choice |
|-------|--------|
| App | Next.js App Router, TypeScript |
| DB | SQLite (e.g. better-sqlite3 or libsql); single file in repo/data |
| UI | Tailwind CSS + shadcn/ui |
| Agents | MCP SDK server process (stdio or local HTTP as convenient for Cursor) |
| Scripts | npm run dev, npm run seed (or seed on first boot), npm run mcp (if separate) |

**Project layout (suggested)**

```
makoons-command-center/
  MVP-SPEC.md          <- this file
  package.json
  src/
    app/               <- App Router pages
    components/        <- Card, sidebar, tabs
    lib/
      schema.ts        <- locked CommandCard
      db.ts            <- SQLite
      seed.ts
    mcp/
      server.ts        <- MCP tools
```

---

## 10. needsJoseph conventions (from leads)

Only flag needsJoseph true when Joseph judgment or credentials are required. Agents do the rest.

| Function | Joseph is needed for | Agents handle without Joseph |
|----------|----------------------|------------------------------|
| Marketing | Post approve + Canva only | Drafts, packet assembly, engage reminders prep |
| Sales | Approve follow-up DM/email, setup call, custom-site / API contract yes | Trial link prep, Chamber materials draft, CRM notes |
| Support | Ship date or major-feature yes | Ticket triage links, Linear filing notices |
| Eng | joseph-pick: card is visible but treated as not started until Joseph pulls it | Staging summaries, QA status updates, BEA diagnosis notes |
| Books | Stripe / cash blockers (login, pk_test, failed charge decisions) | Invoice gap detection cards, non-mutating status |
| COO | Personal todos he owns; rare cross-function yes | Sweeps and nudges that do not need his yes |

When completing a Joseph action, set needsJoseph false (and usually status done or hand off to next agent-owned step).

---

## 11. Deliverables + out of scope

### Deliverables (MVP)

1. Next.js App Router TS app with Home (Needs Joseph + Today), horizons, function sections.
2. Locked shared CommandCard types.
3. SQLite persistence + seed (12 cards, BETA trial due 2026-10-31).
4. MCP tools: list_cards, upsert_card, complete_card, flag_blocker, get_needs_joseph.
5. Tailwind/shadcn desktop UI matching the wireframe intent.
6. npm run dev works from a clean install.
7. This MVP-SPEC.md kept in-repo as source of truth.

### Out of scope (repeat for agents)

- Viselle multi-tenant product surfaces
- Social auto-post / SMS / Buffer
- Stripe write APIs
- Full Linear sync
- PR merge bots
- Charts / analytics
- Multi-user auth

---

## 12. Short Cursor paste prompt

Copy-paste into Cursor to implement:

```
Implement Makoons Command Center per /workspace/makoons-command-center/MVP-SPEC.md (INTERNAL personal ops board, NOT Viselle product UI).

Build Next.js App Router + TS + SQLite + Tailwind/shadcn. Lock CommandCard schema (id, title, owner, cadence daily|weekly|monthly|once, status open|ready|blocked|done, needsJoseph, nextStep, link?, dueDate?, tags?, sourceAgent?, updatedAt, createdAt).

UI: Home with Needs Joseph + Today + blockers; Today/Week/Month; sections eng/marketing/sales/support/books/coo.

MCP tools: list_cards, upsert_card, complete_card, flag_blocker, get_needs_joseph.

Seed 12 cards from section 8; trial card link viselle.net/get-started code BETA dueDate 2026-10-31. Respect needsJoseph conventions in section 10.

Non-goals: no multi-tenant Viselle UI, no social auto-post/SMS/Buffer, no Stripe mutations, no full Linear sync, no PR merge bot, no charts.

Success: npm run dev shows seeded board; MCP can list/upsert/complete/flag/get_needs_joseph.
```

---

## 13. Cursor paste prompt (canonical short form)

> Same content as section 12 — kept as an explicit numbered section so agents can jump to section 13 / paste prompt.

```
Implement Makoons Command Center per MVP-SPEC.md. Next.js App Router TS, SQLite, Tailwind/shadcn, MCP SDK. Schema + IA + MCP tools + 12 seed cards (BETA /get-started due 2026-10-31) + needsJoseph rules as specified. No Viselle multi-tenant, no auto-post/SMS/Buffer, no Stripe mutations, no Linear sync, no PR merge bot, no charts. Ship npm run dev + seed + MCP.
```

---

*End of MVP spec. Prefer editing this file over inventing parallel docs.*
