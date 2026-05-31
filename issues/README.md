# Issues

One file per ticket: `NNN-slug.md`. Each ticket is a vertical slice (schema → service →
endpoint → UI) with explicit `Blocks` / `Blocked by` dependencies, forming a DAG — not phases.

Pick the lowest-ID **unblocked** ticket (every "Blocked by" ticket is Done). See `state/plan.md`
for the live DAG and what's currently unblocked.

## Ticket template

```markdown
# NNN — <title>

**Epic:** <epic>
**Type:** AFK | human-in-loop
**Blocks:** <ids or —>
**Blocked by:** <ids or —>
**PRD trace:** §<section(s)>

## Slice
<what changes across schema / service / endpoint / UI>

## Acceptance
- [ ] <criterion>
- [ ] <criterion>

## Notes
<constraints, gotchas, links>
```

_No tickets yet — pending the PRD. Run the `vertical-slice-kanban` pass once `WRI_PRD_v1.0.md` is populated._
