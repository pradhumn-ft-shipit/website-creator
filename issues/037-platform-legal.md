# 037 — Platform legal: ToS / Privacy / DPA

**Epic:** Legal & privacy
**Type:** AFK drafting (Termly-style) + external counsel gate before private beta — Q5a
**Blocks:** —
**Blocked by:** 001
**PRD trace:** §14.2 (platform-side legal), §14.3 (indemnification), §14.5 (CCPA/CPRA), §17.5 (legal review before private beta)

## Slice
WRI's own legal pages, required before public launch.
- **ToS (§14.2):** covers WRI's service to the advisor; includes the §14.3 indemnification clause (WRI not liable for compliance violations on the advisor's site; advisor is the registered entity).
- **Privacy Policy (§14.2):** WRI's handling of advisor PII and lead PII (controller vs processor split, §14.6); CCPA/CPRA data access + deletion (within 30 days), data inventory, processor list (Vercel/Supabase/Resend/Gemini) (§14.5).
- **DPA template (§14.2):** WRI as data processor for advisor lead data; provided by default in the ToS.
- **Generation:** template-based generator (e.g. Termly) or custom generator with legal review; pages live on the platform marketing/app surface.

## Acceptance
- [x] Platform ToS, Privacy Policy, and DPA template exist and are reachable — `/legal/terms`, `/legal/privacy`, `/legal/dpa` (+ `/legal` index), all statically prerendered (verified via `npm run build`), covered by `src/app/legal/legal-pages.test.tsx`.
- [x] ToS includes the indemnification clause (§14.3) — §5 "Indemnification and limitation of liability" in `src/lib/legal/content.ts` (`TERMS_OF_SERVICE`).
- [x] Privacy reflects controller/processor split + CCPA/CPRA rights + processor list — `PRIVACY_POLICY` §1 (roles), §6–7 (CCPA/CPRA), §5 (`PROCESSORS`: Vercel/Supabase/Resend/Gemini/Firecrawl/Stripe/Cloudflare).
- [x] DPA template is included by default in the ToS — ToS §10 incorporates `/legal/dpa` by reference automatically (no separate signature); `DPA_TEMPLATE` covers roles/sub-processors/assistance/liability.
- [~] Legal-counsel review recorded before private beta (§17.5) — deferred; `LEGAL_REVIEW_PENDING = true` in `src/lib/legal/content.ts` gates every page with a visible "pending counsel review" banner until counsel sign-off is recorded in `state/decisions.md`.

## Notes
- **External prerequisite (§17.5):** legal review of ToS/Privacy/DPA/indemnification **before private beta** — do not treat the generated drafts as final without it.
- Distinct from generated-site legal (022), which covers the *advisor's* site.
