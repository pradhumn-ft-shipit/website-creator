import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runLayer2 } from "./index";

const COMPLIANCE_DIR = join(process.cwd(), "..", "compliance");

describe("runLayer2 (deterministic, against the real ria/v1.0 ruleset)", () => {
  it("fails a fragment containing a hard prohibited term", async () => {
    const result = await runLayer2({
      subject: { kind: "fragment", text: "Our returns are guaranteed.", label: "blog:1" },
      registration: "sec",
      dir: COMPLIANCE_DIR,
    });
    expect(result.verdict).toBe("fail");
    expect(result.violations.some((v) => v.ruleId === "guarantee")).toBe(true);
    expect(result.rulesetVersion).toBe("ria/v1.0");
    expect(result.aiPassRan).toBe(false);
  });

  it("passes a clean fragment (fragment scope does not require footer elements)", async () => {
    const result = await runLayer2({
      subject: { kind: "fragment", text: "We offer fee-only financial planning for families.", label: "blog:2" },
      registration: "sec",
      dir: COMPLIANCE_DIR,
    });
    expect(result.verdict).toBe("pass");
    expect(result.violations).toEqual([]);
  });
});
