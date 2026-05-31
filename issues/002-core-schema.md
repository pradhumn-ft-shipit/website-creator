# 002 — Core database schema + generated types

**Epic:** Platform foundation
**Type:** AFK
**Blocks:** 003, 006, 009, 011, 012, 013, 014, 020, 022, 023, 027, 028, 031, 033 (most feature tickets)
**Blocked by:** 001
**PRD trace:** §10 (data model — full table list), §10.2 (key design decisions), §10.3 (deferred)

## Slice
Lay down the v1 schema spine as a Supabase migration (schema source of truth), then prove it round-trips.
- **Migration:** create all §10.1 tables — `users`, `accounts`, `orders`, `intake_data`, `generated_content`, `assets`, `team_members`, `sites`, `deployments`, `edits`, `leads`, `compliance_rulesets`, `compliance_violations`, `admin_alerts`, `email_log`, `waitlist`, `blog_posts` — with PKs, FKs, and the enum-like `text` status columns exactly as specified.
- **Design decisions honored (§10.2):** accounts separate from users; `generated_content` versioned (never destructive); `sites.current_content_version` pointer; `assets.in_use_locations_json`; `admin_alerts` as the queue; `assets.replaced_from_id` audit chain.
- **RLS:** basic per-account policies (hardening deferred to v1.1 per §10.3).
- **Types:** `npm run gen:types` produces `database.types.ts`; committed.
- **Verify path:** a seed inserts one user→account→order chain; `GET /api/health/db` returns table counts via the envelope.

## Acceptance
- [ ] `npx supabase db push` applies cleanly from a fresh DB; re-running is idempotent.
- [ ] All 17 §10.1 tables exist with the specified columns, PKs, and FKs.
- [ ] `generated_content` and `compliance_rulesets` carry version columns; no destructive-update path exists.
- [ ] `npm run gen:types` regenerates types; `database.types.ts` is committed and typechecks.
- [ ] Seed → `GET /api/health/db` returns row counts through the `{data,error}` envelope.
- [ ] Basic RLS policies present (deny-by-default, owner-account read/write).

## Notes
- Tests build the schema from migrations — never a `create_all` equivalent (CLAUDE.md).
- Deferred per §10.3: UTM/referral tracking, hardened RLS, dedicated admin audit-log table. Do NOT add.
- `compliance_rulesets` is a DB mirror for runtime; the source of truth for rule *content* is the
  versioned repo artifacts under `compliance/` (see 005). DB records which version a site used.
