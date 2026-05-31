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
- [~] New email → signup → verification email → click → authenticated session; `users` + `accounts` rows created. _Built: `POST /api/auth/signup`, the `on_auth_user_created` DB trigger that mints the paired `public.users`+`public.accounts` rows (id == auth.uid()), and `GET /api/auth/callback` (code/token_hash → session). **Live round-trip deferred** — no Supabase/Docker stack this session (same constraint as 001/002)._
- [~] Google OAuth completes and creates the same `users`/`accounts` pair. _Built: `GoogleButton` → `signInWithOAuth` → callback exchange; the same trigger provisions the rows on first sign-in. **Live OAuth deferred** (needs Supabase + Google provider configured)._
- [~] Protected route redirects to login when unauthenticated; reaches it when authenticated. _Built: `src/proxy.ts` + `updateSession` guard; `/dashboard` placeholder behind it; dev server exercised the proxy (GET /login 200). **Authenticated round-trip deferred** (needs a live session)._
- [x] Duplicate-email signup shows the §4.7 message with no status disclosure. _Proven: `service.test.ts` (empty-identities detection) + `signup-form.test.tsx` (neutral dual-action message renders, no navigation/disclosure)._
- [~] Password reset flow works end-to-end. _Built: request (`/api/auth/reset-password`, neutral "sent" — no enumeration) + set-new (`/api/auth/update-password` via recovery session) + both screens; service unit-tested. **Live email round-trip deferred.**_
- [x] Forms have inline validation + loading/error states per §7.6. _Proven: `validation.test.ts`, `login-form.test.tsx`, `signup-form.test.tsx`; visual-QA pass (Lighthouse a11y 100, console clean, responsive 375px/desktop, 44px tap targets)._

## Decision (2026-05-31)
- **User provisioning via DB trigger, not app code.** An AFTER INSERT trigger on `auth.users` mints the paired `public.users` + `public.accounts` rows for *every* signup path (password, OAuth) uniformly, guaranteeing the `public.users.id == auth.uid()` invariant that 002's RLS owner policies depend on. App code can't skip or race it. Email-verified state is mirrored from `auth.users.email_confirmed_at` by a second trigger.
- **Auth via route handlers + `{data,error}` envelope, not Server Actions.** Keeps the central `apiHandler` contract and curl-testability (build-loop step 4); the cookie-bound server client writes session cookies from route handlers fine.
- **§4.7 returning-user detection** uses Supabase's obfuscated-signup signal (a `user` with an empty `identities` array, no error) → neutral "you already have an account" with Sign in / Reset links; no account-status disclosure.
- **`src/middleware.ts` → `src/proxy.ts`** (Next 16 renamed the convention; the old name logs a deprecation warning).
- **Verification email still sent by Supabase's built-in sender.** The `emailRedirectTo` seam already points at our `/api/auth/callback`, so ticket 004 only swaps the sender to Resend templates — no flow change.

## Notes
- One user per account in v1 (§3.2); `accounts.user_id` FK. Multi-user is v1.5 — do not pre-build.
- Verification email sender: start with Supabase; leave a clearly-marked seam to route through 004.
