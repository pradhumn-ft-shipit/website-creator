# Skill: Code Review

**When to use:** After an implementation session has produced commits and is ready for review. Always in a **fresh context** — never in the same session as the implementation.

**Why fresh context:** The implementation session has burned tokens; reviewing in it means reviewing in the dumb zone. A fresh session reviews in the smart zone.

---

## Setup

Before reviewing, load into context:
- The diff being reviewed (full, not summarized)
- The ticket the diff is supposed to fulfill
- The project's coding standards (push them in — do not rely on pull during review)
- The module map for any new/changed modules

---

## Review order

### 1. Tests first
Read the tests before the implementation.

- Do the tests describe the behavior the ticket asked for?
- Do they test through the public interface, or do they reach into internals?
- Are there missing tests for obvious edge cases?
- Did any existing test get weakened (assertion loosened, case removed) in this diff?

### 2. Interface / module map
- Does the new code respect the proposed module map?
- Were new modules added that weren't in the map? Are they justified, or shallow?
- Did any module's interface widen unnecessarily?

### 3. Implementation
- Now read the implementation.
- Does it do what the tests say it does?
- Does it do anything the tests don't cover?
- Are there obvious failure modes that aren't handled?

### 4. Cross-cutting
- Coding standards adhered to?
- Any new dependencies added? Justified?
- Any destructive changes (deletes, schema drops, file moves) without confirmation?
- Any commits that should be split?

---

## Output format

For each finding:
- **Severity:** blocker | should-fix | nit
- **Location:** file:line
- **Issue:** what's wrong
- **Suggested fix:** concrete

End with a summary: total findings by severity, and a recommendation — merge as-is, merge with should-fixes, or block.

---

## What review does NOT do

- It does not implement fixes. It flags them. Fixes go in a follow-up session against new tickets created from the blockers.
- It does not run the code. Static review only. Functional QA is a separate step.
