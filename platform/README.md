# WRI Platform

The WRI advisor-facing platform — Next.js (App Router) + TypeScript on Vercel.
Supabase (Postgres + Auth + Storage), shadcn/ui + Tailwind + Lucide. See the repo
root `CLAUDE.md` and `WRI_PRD_v1.0.md` for product context.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys (Supabase required to run auth/DB)
```

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Start built app | `npm run start` |
| Tests (Vitest) | `npm test` (watch: `npm run test:watch`) |
| Single test | `npm test -- src/path.test.ts -t "name"` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Regenerate DB types | `npm run gen:types` (after any migration) |

**Supabase migrations** (CLI initialized under `supabase/`):

```bash
npx supabase migration new <name>
npx supabase db push
npm run gen:types   # requires a running local Supabase (`npx supabase start`) or a linked project
```

## Conventions

- **API envelope** — every API route is wrapped by `apiHandler` (`src/lib/api/envelope.ts`)
  so responses are always `{ data, error }`. Routes return a payload or throw `AppError`
  for expected failures; never hand-build the envelope. See `/api/health`.
- **Supabase clients** — `src/lib/supabase/server.ts` (Server Components / Route Handlers /
  Actions) and `src/lib/supabase/client.ts` (Client Components).
- **UI** — shadcn/ui components live in `src/components/ui` (copy-into-codebase). Single
  library only: shadcn/ui + Tailwind + Lucide. Design tokens (§7.3) in `src/app/globals.css`.
- **Tests** — Vitest + Testing Library; component/UI tests live next to the code as
  `*.test.tsx`. Every UI change ships a frontend test (CLAUDE.md build loop §8).

## Verify path

`GET /api/health` → `{"data":{"status":"ok"},"error":null}`; `/health` renders it and the
"Re-check" button re-fetches the live route.
