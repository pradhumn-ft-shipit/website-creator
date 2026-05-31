# 021 — Copy preview + revision rounds (max 3) + final approval

**Epic:** Auth & onboarding
**Type:** human-in-loop (wireframe checkpoint before build — Q1c)
**Blocks:** 024
**Blocked by:** 020
**PRD trace:** §4.1 (steps 13–15), §5.2 (Layer 2 on revisions), §13.1 (copy_review → copy_approved)

## Slice
Let the advisor review generated copy, request up to 3 revisions, and approve the build.
- **Preview:** render all `generated_content` for review (page by page).
- **Revisions (§4.1.13):** up to 3 rounds via chat instruction or direct text edit; each revision creates a new `generated_content` version (never destructive) via Gemini Flash, then re-runs **Layer 2** (006). Enforce the max-3 cap (state machine `revision_requested` loop).
- **Approval:** "Build my site" → `copy_approved` transition (009) → build handoff screen ("check your email in ~15 min, you can log off").
- **States:** loading/empty/error per §7.6.

## Acceptance
- [ ] All generated copy renders for review.
- [ ] Revision (chat or direct edit) creates a new `generated_content` version and re-runs Layer 2.
- [ ] Revision count is capped at 3; further requests are blocked with explanation.
- [ ] "Build my site" sets `copy_approved` and shows the build-handoff screen.
- [ ] No destructive updates — version history is intact.

## Notes
- Revisions go through the same Layer-2 gate as initial generation — never approve unvalidated copy (CLAUDE.md).
- Load `skills/frontend-design.md`; this is advisor-facing.

## Decision (2026-05-31)
- **Q1c — wireframe checkpoint.** Copy review gates "Build my site," so one wireframe approval, then AFK. The max-3 revision loop + Layer-2 re-validation logic needs no mid-build input.
