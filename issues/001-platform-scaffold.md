# 001 — Platform scaffold & API envelope

**Epic:** Platform foundation
**Type:** AFK
**Blocks:** 002, 003, 004, 005, 007, 008, 009, 011, 016, 037 (and transitively almost everything)
**Blocked by:** —
**PRD trace:** §7.3 (platform visual language), §7.5 (component library), §9.1 (stack), CLAUDE.md (API contract)

## Slice
Stand up the Next.js platform with the conventions every later ticket depends on, proven by one thin end-to-end path.
- **Tooling:** `platform/` Next.js (App Router) + TypeScript; Tailwind; shadcn/ui init (Radix, copy-into-codebase); Lucide. `npm run dev | build | lint | typecheck` all work. Vitest configured (`npm test`).
- **Supabase:** client + server helpers; env wiring (`.env.example`); `supabase` CLI initialized; `npm run gen:types` placeholder.
- **API envelope (deep module):** central handler that wraps every route response as `{data,error}`. `AppError` class for expected failures → mapped to `{data:null,error:{message,code}}`. Success → `{data:payload,error:null}`. Routes return payloads / throw `AppError`; never hand-build the envelope.
- **App shell:** base layout (Inter, neutral palette + one accent + semantic colors per §7.3), 404, loading + error boundary.
- **Verify path:** `GET /api/health` returns `{data:{status:"ok"},error:null}` via the envelope; `/health` page renders it. One `AppError` unit test proves the error shape.

## Acceptance
- [ ] `npm run dev`, `build`, `lint`, `typecheck`, `test` all pass from `platform/`.
- [ ] `GET /api/health` returns the exact `{data,error}` envelope; a forced `AppError` returns `{data:null,error:{message,code}}`.
- [ ] `/health` page renders the API result; base layout uses Inter + the §7.3 palette.
- [ ] shadcn/ui + Lucide installed and one component (e.g. Button) renders.
- [ ] `.env.example` documents required keys; README in `platform/` lists the commands.

## Notes
- Single library only: shadcn/ui + Tailwind + Lucide. No other UI lib without a `state/decisions.md` entry.
- Do NOT scatter envelope construction — it lives in one place and is the only way responses are shaped.
- Keep the module map shallow-interface/deep-internals (load `skills/deep-modules.md` before adding files).
