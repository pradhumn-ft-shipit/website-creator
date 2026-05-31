# 003 — Auth: signup / login + email verification

**Epic:** Auth & onboarding
**Type:** AFK
**Blocks:** 010, 027, 032, 033
**Blocked by:** 001, 002
**PRD trace:** §4.1 (steps 2–3 account creation + verification), §4.7 (returning user edge case), §9.1 (Supabase Auth)

## Slice
End-to-end auth so an advisor can create an account, verify email, and land authenticated.
- **Service:** Supabase Auth — email/password + Google OAuth. On signup, create the `users` row and a paired `accounts` row (one account per user in v1).
- **Email verification:** verification link (Supabase built-in send for v1; swap to Resend templates once 004 lands — note in code). Unverified users cannot proceed past account creation.
- **Session:** Next.js middleware guards authenticated routes; redirects unauthenticated to login.
- **Returning user (§4.7):** signup with an existing email shows *"It looks like you already have a WRI account. [Sign in] or [Reset password]."* — no account-status disclosure.
- **UI:** signup, login, "check your email", verified-success, password reset screens (§7.6 states: loading/error/inline validation).

## Acceptance
- [ ] New email → signup → verification email → click → authenticated session; `users` + `accounts` rows created.
- [ ] Google OAuth completes and creates the same `users`/`accounts` pair.
- [ ] Protected route redirects to login when unauthenticated; reaches it when authenticated.
- [ ] Duplicate-email signup shows the §4.7 message with no status disclosure.
- [ ] Password reset flow works end-to-end.
- [ ] Forms have inline validation + loading/error states per §7.6.

## Notes
- One user per account in v1 (§3.2); `accounts.user_id` FK. Multi-user is v1.5 — do not pre-build.
- Verification email sender: start with Supabase; leave a clearly-marked seam to route through 004.
