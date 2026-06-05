import { describe, expect, it } from "vitest";

import { isAdminEmail, parseAdminAllowlist } from "./auth";

describe("parseAdminAllowlist", () => {
  it("splits on commas and whitespace, trims, lowercases, drops empties", () => {
    expect(
      parseAdminAllowlist(" Ops@WRI.io , team@wri.io\nfounder@wri.io ,,"),
    ).toEqual(["ops@wri.io", "team@wri.io", "founder@wri.io"]);
  });

  it("returns an empty list for undefined / empty input", () => {
    expect(parseAdminAllowlist(undefined)).toEqual([]);
    expect(parseAdminAllowlist("")).toEqual([]);
    expect(parseAdminAllowlist("   ")).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  const allowlist = "ops@wri.io, team@wri.io";

  it("matches a listed email case-insensitively, ignoring surrounding space", () => {
    expect(isAdminEmail("ops@wri.io", allowlist)).toBe(true);
    expect(isAdminEmail("OPS@WRI.IO", allowlist)).toBe(true);
    expect(isAdminEmail("  team@wri.io  ", allowlist)).toBe(true);
  });

  it("rejects an email not on the list", () => {
    expect(isAdminEmail("advisor@example.com", allowlist)).toBe(false);
  });

  it("fails closed on a null/empty email or an empty allowlist", () => {
    expect(isAdminEmail(null, allowlist)).toBe(false);
    expect(isAdminEmail(undefined, allowlist)).toBe(false);
    expect(isAdminEmail("", allowlist)).toBe(false);
    // No allowlist configured → nobody is an admin (deny-by-default).
    expect(isAdminEmail("ops@wri.io", "")).toBe(false);
    expect(isAdminEmail("ops@wri.io", undefined)).toBe(false);
  });
});
