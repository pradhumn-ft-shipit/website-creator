# Skill: Break PRD into Vertical-Slice Kanban

**When to use:** Immediately after a PRD is approved, to convert it into independently grabbable tickets in `issues/`.

**When NOT to use:** Before the PRD is settled. Before destination and out-of-scope are clear.

---

## The model

The plan is a **DAG**, not a sequence. Each node is a ticket. Each ticket:

- Is a **vertical slice** through the stack — schema, service, endpoint, UI — that produces something visible end-to-end.
- Declares **blocks** and **blocked by** by ticket ID.
- Is **independently grabbable** — an agent can pick it up given only the ticket file and the codebase.
- Is typed `AFK` (no human input needed during the work) or `human-in-loop` (decisions during the work need me).

There are no numbered phases. Phase 1 is "everything with no blockers." Phase 2 is "everything that becomes unblocked after Phase 1." Multiple agents can work Phase 1 in parallel.

---

## Process

1. **Re-read the PRD.** Identify the user-visible outcomes and the out-of-scope list.

2. **Draft slices.** For each user-visible outcome, draft one or more tickets that each walk the full stack for a thin piece of that outcome. The first ticket of any feature must reach the UI — even minimally.

3. **Check for horizontal smell.** If a ticket is "build the X service" or "add the Y schema," it is horizontal. Rework it into a slice that touches at least DB → service → endpoint → UI, even if trivially.

4. **Declare blockers honestly.** A blocker is a true technical prerequisite (the schema field must exist before the service can read it). It is NOT a preference for ordering. If two tickets do not technically block each other, leave them parallel.

5. **Mark types.**
   - `AFK` — acceptance criteria are objective; no taste calls; no missing info.
   - `human-in-loop` — needs a design call, copy decision, UX choice, or any judgement I haven't already made.

6. **Set acceptance.** Each ticket has explicit acceptance criteria. "Done" is testable, not vibes.

---

## Ticket file format

`issues/NNN-<slug>.md`:

```markdown
# NNN — <title>

**Type:** AFK | human-in-loop
**Blocks:** NNN, NNN
**Blocked by:** NNN, NNN

## Slice
What this ticket changes, layer by layer:
- Schema: ...
- Service: ...
- Endpoint: ...
- UI: ...

## Acceptance
- [ ] Concrete checkable item
- [ ] Concrete checkable item

## Notes
Anything an agent picking this up cold should know.
```

---

## Output when done

Show me the full ticket list with the DAG visible — which tickets block which — so I can sanity-check the shape before any implementation starts. A simple indented list is fine:

```
001 — schema for X            (AFK, no blockers)
002 — first-render of X UI    (AFK, blocks: 003, 005)
003 — edit flow for X         (human-in-loop, blocked by: 002)
004 — backfill old records    (AFK, blocked by: 001)
005 — polish X dashboard      (human-in-loop, blocked by: 002)
```
