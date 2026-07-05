# 00A — Platform design system & visual identity

**Epic:** Foundation / design
**Type:** human-in-loop (direction sign-off on the Slice-1 proof; rollout is AFK)
**Blocks:** every platform UI ticket — re-touches 001, 003, 027; gates the *look* of 028, 029, 030, 031, 032, 033, 034, 035, 010, 013, 020
**Blocked by:** — (foundational; can run now)
**PRD trace:** §7.3 (visual system), §7.5 (single component library), §7.6 (states), §7.13 (reference bar), §7 overall

## Why this exists
The platform shipped on default shadcn tokens (cold neutral grays + a generic indigo, flat borders, no
elevation/type scale/motion). Every screen so far (001 health, 003 auth, 027 dashboard + Settings) inherited
that blandness — functional but generic and low-trust. 00A defines the **platform** design system once and
re-skins existing screens to it, so all future tabs (028–037, onboarding, admin) are built against a real
identity instead of re-deciding per screen.

**Scope boundary:** platform surface only (advisor dashboard, onboarding, auth, `/admin`). Does **not** touch
the three customer templates (016–019) — those are intentionally three distinct looks (Trust / Modern /
Boutique) and own their design language.

## Direction (decided 2026-05-31 — see `state/decisions.md`)
Confirmed with the owner via a 4-question round:
- **Aesthetic = Mercury/Ramp** — warm trust-fintech: calm, rounded, conservative, "established." Soft layered
  depth over hard borders. Distinctive WRI identity at Stripe-grade craft, **not** a Stripe clone.
- **Brand accent = emerald / teal** — money / growth / trust; deliberately *not* the indigo sea of fintech.
- **Mode = light-first only** for v1. Keep dark CSS vars stubbed but light is the sole deliverable; dark is v1.5.
- **Density = balanced** — roomy on empty/marketing/onboarding states, tighter on data views (leads, blog, admin).

## Design language (the system to build)
- **Neutrals → warm.** Replace the cold slate ramp with a **warm stone/sand neutral** ramp (oklch hues in the
  ~70–95 range, low chroma) for bg / card / muted / border / foreground. This single change is most of the
  "warmth."
- **Accent = emerald.** `--color-primary` → emerald (≈ oklch 0.55 0.12 165). Used confidently but sparingly:
  primary buttons, selected/active states, focus rings, key links. Must stay distinguishable from `success`
  (resolve the primary↔success green collision at build: differentiate by lightness + usage, or nudge success
  cooler). Recalibrate `warning` (warm amber), `destructive` (warm red), `info` to sit in harmony with warm
  neutrals + emerald — and re-verify all tinted Badge variants clear WCAG AA on their washes (the §7 fix from
  027 must survive the re-palette).
- **Radius up.** Cards ~`14px`, inputs/buttons ~`10px`, badges = pill. Rounded = core to the Mercury feel.
- **Elevation.** Define soft, low-contrast shadow tokens (sm/md/lg) — layered depth, not flat 1px borders alone.
- **Type scale.** Establish a real scale (display / h1 / h2 / h3 / body / small / caption) with deliberate
  size/weight/tracking/line-height. Keep Inter for body; tighten heading tracking. Optionally a warmer display
  face — only if it earns its weight (dependency guardrail).
- **Motion.** Calm, consistent transitions (≈150–200ms ease) on hover / press / focus. No bounce.
- **Primitives.** Upgrade `Button`, `Input`, `Label`, `Badge`, and add a shared `Card` primitive (Settings &
  Site Overview both hand-roll `bg-card rounded-xl border` today — consolidate). All consume tokens only.

## Slices
- **Slice 1 (this ticket's proof, HIL sign-off):** token system in `globals.css` (`@theme`) + upgraded
  primitives + a shared `Card` + **re-skin the Settings screen** as the reference. Drive it on the `:5500`
  preview, owner approves the direction before rollout. Target ≤ the file-count needed for tokens + primitives
  + Settings; keep it reviewable.
- **Slice 2 (AFK):** roll the system across the **dashboard shell + Site Overview + the §7.6 loading/error/empty
  states** (027 surfaces).
- **Slice 3 (AFK):** roll across **auth screens (003)** + the `/health` + `/` landing (001).
- _Onboarding (010/013) and admin (033–035) adopt the system natively when they're built — no back-fill
  slice needed._

## Acceptance
- [x] A documented token set (warm neutrals + emerald + recalibrated semantics + radius + shadow + type scale)
  lives in `globals.css `@theme` (single source); no screen hardcodes a raw hex/oklch outside it (the 027
  fixed-oklch badge exception is folded into the Badge variants). _Warm stone neutrals + deep emerald
  `--primary` (darkened to clear AA on white) + warm-harmonized success/warning/destructive + `--radius` 0.75rem
  + soft warm-tinted `--shadow-{xs,sm,card}` + Fraunces/Hanken font vars._
- [x] Upgraded `Button` / `Input` / `Badge` + a shared `Card` primitive (`CardHeader/Title/Description/Content`),
  all token-driven; existing call-sites unchanged in API. _(Label inherits the tokens unchanged.)_
- [x] Settings screen re-skinned to the Mercury/emerald direction and **approved by the owner** on `:5500`
  ("yeah looks better").
- [x] All tinted Badge / status variants pass WCAG AA on their washes under the new palette. _Lighthouse
  `color-contrast` audit = perfect pass on the re-skinned Settings._
- [x] Visual-QA on the re-skinned Settings: best-practices 100, a11y effectively 100 (only `landmark-one-main`,
  supplied by the shell `<main>` in production), console clean, 390 + 1280px, light theme.
- [x] No regression: `npm test` (96) / `typecheck` / `lint` / `build` green; all component tests pass against the
  new primitives.
- [x] Slices 2–3 land the system across 027 + 003 + 001 surfaces with the same QA bar. _Slice 2: dashboard
  shell (emerald brand + emerald active-nav pill), Site Overview (banner + stat cards → `Card`), loading/error/
  coming-soon rounded-2xl + emerald accent chips. Slice 3: auth layout (soft `shadow-card`, emerald wash) — login
  visual-QA **a11y 100 / best-practices 100**, console clean; landing/health inherit via tokens + `Button`._

## Notes
- Load `skills/frontend-design.md` before building Slice 1 — it enforces §7 and pushes distinctive-over-generic.
- Reuse the 027 visual-QA recipe (temp public `preview-*` route + dummy `.env.local`, fully torn down) since
  the real screens are auth-gated and there's no Supabase locally.
- Keep dark-mode CSS vars present but out of scope for v1 QA (light-first decision).
