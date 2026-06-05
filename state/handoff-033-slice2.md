# Handoff — 033 Slice 2: Admin order detail view

> **Read this first if you're picking up 033 in a new context.** Then read
> `issues/033-admin-orders.md` (Slices section), the `2026-06-01 — 033 (Slice 1)`
> entry in `state/decisions.md`, and `state/plan.md` (033 in **In progress**).

## Where things stand

**033 Slice 1 is DONE** (gate + order queue + one-click retry), green on
`npm test` (201), typecheck, lint, build; visual-QA a11y 100 / bp 100. **Not yet
committed** — kept local per repo convention. (Also uncommitted in the tree, from
a *prior* session and NOT part of 033: `gemini/*`, `account/service.ts`,
`inngest/pipeline.ts`, `state/reviews/` — leave them alone unless asked.)

### What Slice 1 already built (reuse these)
- `platform/src/lib/admin/auth.ts` — `requireAdmin()` (page gate, 404 on non-admin)
  / `assertAdmin()` (API gate, 403). **Reuse verbatim** for the detail page + any
  detail API route.
- `platform/src/lib/admin/orders.ts` — one deep module: pure classification
  (`stateTone`/`stateGroup`/`humanizeStatus`/`formatDuration`), `shapeAdminOrders`,
  IO `listAdminOrders` (service-role, embeds account+email+alert), and the
  `retryOrder`/`dismissAlert` actions. **Extend here** with `getAdminOrderDetail(orderId)`.
- `platform/src/components/admin/shell.tsx` — `AdminShell` (top-nav console chrome).
  Detail page renders inside it (it's `/admin/orders/[id]`, under the `/admin` layout).
- `platform/src/components/admin/orders-table.tsx` — the queue table. **Add the
  row→detail link here** (Order id cell → `/admin/orders/[id]`). Currently the id is
  a plain `<code>` (no link) by design — Slice 1 had no detail page to point at.
- `platform/src/app/admin/layout.tsx` already gates the whole `/admin/*` subtree.

## Slice 2 goal (closes the last open acceptance criterion)

`[~] Detail view shows state history, intake, content preview, violations, deploy logs.`
— PRD §11.1 "Order detail view":
- **Full state-machine history** (the timeline of transitions)
- **Intake data summary** (`intake_data` row: existing_site_url, scrape result, uploaded docs)
- **Generated content preview** (`generated_content` versions for the order)
- **Compliance violations** (`compliance_violations` rows for the order)
- **Deployment logs** (`deployments` rows via the order's `sites` row)
- **Manual retry / step-through buttons** (Retry already exists in `orders.ts` — reuse `retryOrderById`)

## The one real design decision: state-machine history needs schema

**009 does NOT record transition history** — `transitionOrder` only overwrites the
current `orders.status` + `state_machine_position`. So "full state-machine history"
requires a new append-only audit table. Proposed (confirm before building):

```sql
-- migration: order_state_events (append-only transition log)
create table public.order_state_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,                     -- null for the initial state
  to_status   text not null,
  occurred_at timestamptz not null default now(),
  note        text                      -- e.g. "admin retry", failing step
);
create index order_state_events_order_id_idx on public.order_state_events (order_id, occurred_at);
```
- Write one row from `transitionOrder` (`platform/src/lib/orders/transitions.ts`)
  on every successful persist — additive, non-breaking change to 009's IO layer.
- Also write a `to_status: 'payment_received', note: 'admin retry'` event from
  `retryOrder` so the reset shows in history.
- This table **also yields precise time-in-current-state** (now − latest event's
  `occurred_at`) → upgrade `shapeAdminOrders`' approximate `timeInStateMs` (it
  currently measures from the failure alert / created_at — see decisions.md) and
  the queue column at the same time. RLS: internal table, no policy (service-role
  only), same as `admin_alerts`.
- Remember to update `platform/src/types/database.types.ts` by hand (gen:types still
  needs Docker) + the `schema.test.ts` table list.

## Module map (proposed)

- **Schema:** new migration `*_order_state_events.sql` + `database.types.ts` + `schema.test.ts`.
- **009 touch:** `lib/orders/transitions.ts` — append an event in `transitionOrder`
  (and a helper the retry path can call). Keep the pure core (`state-machine.ts`) IO-free.
- **Data layer:** `lib/admin/orders.ts` — add `getAdminOrderDetail(orderId)` (service-role
  read of order + intake_data + generated_content + compliance_violations + sites→deployments
  + order_state_events) returning a shaped `AdminOrderDetail`. Keep shaping pure + tested.
- **Page:** `app/admin/orders/[id]/page.tsx` (server, `requireAdmin` is inherited from
  layout but resolve the user if needed) + `not-found.tsx` for a bad id.
- **Components:** `components/admin/order-detail.tsx` (presentational: history timeline,
  intake card, content-version list, violations list, deploy-log table, Retry/Dismiss reusing
  the existing action pattern). Consider splitting if it exceeds the 5-file guardrail —
  this slice may itself want sub-slicing.
- **Test:** `order-detail.test.tsx` (frontend) + extend `orders.test.ts` (detail shaping).

## Constraints / conventions (same as the whole repo)
- **No Docker/Inngest this session-style** — live DB reads + live retry round-trip are
  deferred; prove via pure unit tests + a frontend test + the temp-preview visual-QA recipe.
- **Visual-QA recipe** (from decisions.md, reused successfully in Slice 1): dummy
  `platform/.env.local` + a temp public `/preview-*` route rendering the detail with mock
  data + temp `PUBLIC_PATHS` entry in `lib/supabase/middleware.ts` → drive chrome-devtools
  → **tear it ALL down** before finishing.
- Service-role client for all admin reads (orders/intake/content/violations/deployments are
  RLS-internal or owner-scoped — admin legitimately spans accounts).
- §7.10: admin UI may be lower-fidelity but never broken; inherits 00A tokens/primitives.
- 5-file guardrail: if Slice 2 sprawls, split it (e.g. 2a = history+intake, 2b = content+violations+deploy).
- Build-loop §8: frontend test **+** live route in the push summary; visual-QA loop before "done".

## Verify before declaring done
`cd platform && npm test && npm run typecheck && npm run lint && npm run build`
(all must be green), then the chrome-devtools pass on the detail view. Tick the `[~]`
acceptance box in `issues/033-admin-orders.md` → `[x]`, mark 033 fully Done in `plan.md`,
append a Slice-2 entry to `decisions.md`.

## Open prerequisite (carried from Slice 1)
- Set **`ADMIN_EMAILS`** (server env) to the WRI team's emails before `/admin/*` is reachable.
