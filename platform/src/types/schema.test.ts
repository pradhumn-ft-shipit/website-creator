import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PUBLIC_TABLES } from "./database.types";

/**
 * Static schema-consistency checks. The DB itself can't be applied here (no
 * local Postgres in CI without Docker), so we assert against the migration SQL
 * — the schema source of truth (CLAUDE.md) — and against the hand-authored
 * types that must mirror it. Catches drift between the migration, the types,
 * and the PRD §10.1 table list without needing a running database.
 */

// vitest runs with cwd = platform/, so resolve migrations from there.
const migrationsDir = join(process.cwd(), "supabase", "migrations");
const coreSchema = readFileSync(
  join(migrationsDir, "20260531131303_core_schema.sql"),
  "utf8",
);
const rlsPolicies = readFileSync(
  join(migrationsDir, "20260531131305_rls_policies.sql"),
  "utf8",
);
const orderStateEvents = readFileSync(
  join(migrationsDir, "20260601120000_order_state_events.sql"),
  "utf8",
);

/** The 17 §10.1 tables. */
const EXPECTED_TABLES = [
  "users",
  "accounts",
  "orders",
  "intake_data",
  "generated_content",
  "assets",
  "team_members",
  "sites",
  "deployments",
  "edits",
  "leads",
  "compliance_rulesets",
  "compliance_violations",
  "admin_alerts",
  "email_log",
  "waitlist",
  "blog_posts",
];

describe("core schema migration", () => {
  it("creates all 17 PRD §10.1 tables", () => {
    for (const table of EXPECTED_TABLES) {
      expect(coreSchema).toContain(`create table public.${table} (`);
    }
    expect(EXPECTED_TABLES).toHaveLength(17);
  });

  it("keeps PUBLIC_TABLES in lockstep with the migration", () => {
    expect([...PUBLIC_TABLES].sort()).toEqual([...EXPECTED_TABLES].sort());
  });

  it("versions generated_content and compliance_rulesets", () => {
    expect(coreSchema).toMatch(/generated_content[\s\S]*?version\s+int/);
    expect(coreSchema).toMatch(/compliance_rulesets[\s\S]*?version\s+text/);
  });

  it("guards against destructive updates on the versioned tables", () => {
    // append-only triggers exist for both versioned tables
    expect(coreSchema).toContain(
      "create trigger generated_content_immutable",
    );
    expect(coreSchema).toContain(
      "create trigger compliance_rulesets_immutable",
    );
  });

  it("carries the assets replacement audit chain", () => {
    expect(coreSchema).toMatch(
      /replaced_from_id\s+uuid references public\.assets/,
    );
  });
});

describe("RLS policies migration", () => {
  it("enables row-level security on every table", () => {
    for (const table of EXPECTED_TABLES) {
      expect(rlsPolicies).toMatch(
        new RegExp(`alter table public\\.${table}\\s+enable row level security;`),
      );
    }
  });

  it("denies internal/admin tables by leaving them policy-less", () => {
    // No owner policy is created for these — RLS-on + no-policy = deny by default.
    for (const internal of [
      "compliance_rulesets",
      "compliance_violations",
      "admin_alerts",
      "email_log",
      "waitlist",
    ]) {
      expect(rlsPolicies).not.toMatch(
        new RegExp(`create policy \\w+ on public\\.${internal}\\b`),
      );
    }
  });
});

describe("order_state_events migration (033 Slice 2)", () => {
  it("creates the append-only transition log keyed on the order", () => {
    expect(orderStateEvents).toContain("create table public.order_state_events (");
    expect(orderStateEvents).toMatch(
      /order_id\s+uuid not null references public\.orders \(id\) on delete cascade/,
    );
    expect(orderStateEvents).toMatch(/to_status\s+text not null/);
  });

  it("indexes by (order_id, occurred_at) for timeline reads", () => {
    expect(orderStateEvents).toMatch(
      /create index order_state_events_order_id_idx[\s\S]*?\(order_id, occurred_at\)/,
    );
  });

  it("is an internal table: RLS enabled, no policy (service-role only)", () => {
    expect(orderStateEvents).toMatch(
      /alter table public\.order_state_events\s+enable row level security;/,
    );
    expect(orderStateEvents).not.toMatch(
      /create policy \w+ on public\.order_state_events\b/,
    );
  });

  it("stays out of the §10.1 core data model (PUBLIC_TABLES)", () => {
    expect(PUBLIC_TABLES).not.toContain("order_state_events");
  });
});
