---
name: frontend-visual-qa
description: Drive a real headless Chrome via the chrome-devtools MCP to visually QA front-end work — platform screens and the three customer templates. Use after building or changing any UI, to actually look at the rendered result (dark mode, layout, responsiveness), run a Lighthouse audit (§6.10), check accessibility (§7 / WCAG 2.1 AA), and inspect console/network before declaring a slice done. This is the ad-hoc visual feedback loop, NOT the committed automated test — both are required (see CLAUDE.md build loop step 8).
---

This skill is the **visual feedback loop**: the browser an agent uses to *see* what it built, the same ad-hoc QA a human front-end dev does — write code, look at the UI, iterate. It is wired in via the `chrome-devtools` MCP server (`.mcp.json`), which launches its own headless Chrome on the first tool call. No remote-debugging-port setup, no manual Chrome launch.

## This is HALF of the front-end requirement — never the whole thing

CLAUDE.md build loop step 8 demands two distinct things on every UI push. Do not conflate them:

1. **A committed automated frontend test** — Playwright test / Vitest browser mode, wired into `npm test`, that runs on every push and in CI. This skill does **not** produce that. Write the real test separately.
2. **The visual QA loop (this skill)** — you, looking at the rendered UI through the browser, before you declare the slice done. Ephemeral, not committed.

If you only do (2), the slice is not done. The MCP browser is for *your* confidence and for catching what tests miss; it never replaces the test the user will re-run.

## Setup (already done — just use it)

`.mcp.json` registers the `chrome-devtools` server. Tools appear as `mcp__chrome-devtools__*`. First tool call boots headless Chrome (Puppeteer-bundled). Point it at whatever you're running:
- **Platform:** `cd platform && npm run dev` → navigate to `http://localhost:3000/<route>`, or a Vercel preview URL.
- **Templates:** `cd templates/{trust|modern|boutique} && npm run dev` → navigate to the local Astro URL.

## Workflow

1. **Navigate** — `navigate_page` (or `new_page`) to the route under test. `wait_for` known text if content loads async.
2. **Snapshot first, screenshot second** — call `take_snapshot` (text accessibility tree with element `uid`s) to understand structure and to drive interactions. Only call `take_screenshot` when you genuinely need to *see* pixels (layout, spacing, visual regression). Snapshots are far cheaper in context than screenshots — default to them.
3. **Interact** — `click`, `fill`, `fill_form` (batch — prefer over multiple `fill` calls), `hover`, `press_key`, `upload_file`, using `uid`s from the latest snapshot. Pass `includeSnapshot: false` on actions unless you need the refreshed state. If a `uid` misses, take a fresh snapshot — the DOM changed.
4. **Verify state** — `list_console_messages` for errors/warnings; `list_network_requests` (filter + paginate) for failed/slow calls; `evaluate_script` for anything not in the a11y tree.

## WRI-specific checks (pull exact thresholds from the PRD)

- **Dark mode** — `emulate` with `colorScheme: "dark"` then re-snapshot/screenshot. The video's exact failure: a site using `@media (prefers-color-scheme: dark)` won't flip by toggling a `.dark` class — `emulate` is the correct lever. Verify both modes render acceptably.
- **Responsive** — `resize_page` (or `emulate` viewport/device) across mobile + desktop widths; confirm no overflow/broken layout.
- **Lighthouse (§6.10)** — `lighthouse_audit` on each template page; it must clear the PRD §6.10 thresholds before merge. This complements `npm run lighthouse`, it doesn't replace the gate.
- **Accessibility (§7 / WCAG 2.1 AA)** — read the `take_snapshot` accessibility tree for missing roles/labels/landmarks; for a full audit use `lighthouse_audit` (accessibility category). Still run `npm run a11y` (axe-core) as the gate.
- **Performance** — `performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight` (e.g. LCPBreakdown) when chasing Core Web Vitals regressions.
- **Contact form** — exercise the real flow (`fill_form` → submit), and confirm via `list_network_requests` that it posts; remember Turnstile gates production submissions.

## Token discipline (this server can be context-heavy)

- Prefer `take_snapshot` over `take_screenshot`. Use `verbose: false`.
- Pass `filePath` for screenshots/traces/reports so large blobs land on disk, not in context.
- Filter + paginate network and console lists; don't dump everything.
- Reuse one page across checks rather than re-navigating repeatedly.

## When the MCP isn't enough

For deep manual inspection beyond these tools, fall back to the Chrome DevTools UI / docs. For launch or connection errors, see `info-for front-end sikll/chrome-devtools-mcp-main/docs/troubleshooting.md`.
