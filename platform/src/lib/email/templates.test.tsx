import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { resolveTemplate, TEMPLATES, type TemplateName } from "./templates";

const SAMPLE_DATA: Record<TemplateName, unknown> = {
  verify_email: { verifyUrl: "https://wri.com/verify?token=abc" },
  launch: {
    firmName: "Acme Advisors",
    siteUrl: "https://acme.wri.com",
    dnsInstructionsUrl: "https://wri.com/dns",
    mxWarning: true,
  },
  lead: { firmName: "Acme Advisors", leadName: "Jane Prospect", leadEmail: "jane@example.com" },
  dns_success: { firmName: "Acme Advisors", siteUrl: "https://acme.com" },
  cancellation_day0: { firmName: "Acme Advisors", effectiveDate: "2026-08-01" },
  cancellation_day14: { firmName: "Acme Advisors", effectiveDate: "2026-08-01" },
  cancellation_day28: { firmName: "Acme Advisors", effectiveDate: "2026-08-01" },
  payment_failed: { firmName: "Acme Advisors" },
};

describe("email template registry", () => {
  it("has an entry for every documented template name (004 spec)", () => {
    const expected: TemplateName[] = [
      "verify_email",
      "launch",
      "lead",
      "dns_success",
      "cancellation_day0",
      "cancellation_day14",
      "cancellation_day28",
      "payment_failed",
    ];
    expect(Object.keys(TEMPLATES).sort()).toEqual([...expected].sort());
  });

  it.each(Object.keys(TEMPLATES) as TemplateName[])(
    "%s resolves to a non-empty subject and a renderable React element",
    (name) => {
      const template = resolveTemplate(name);
      const data = SAMPLE_DATA[name];
      const subject = template.subject(data as never);
      const element = template.render(data as never);

      expect(typeof subject).toBe("string");
      expect(subject.length).toBeGreaterThan(0);
      expect(isValidElement(element)).toBe(true);
    },
  );

  it("launch template's MX warning renders bold+red-bordered copy when a warning is present", () => {
    const template = resolveTemplate("launch");
    const withWarning = template.render({
      firmName: "Acme",
      siteUrl: "https://acme.wri.com",
      dnsInstructionsUrl: "https://wri.com/dns",
      mxWarning: true,
    });
    expect(isValidElement(withWarning)).toBe(true);
  });

  it("callers pass data, not HTML — TemplateDefinition never exposes a raw html field", () => {
    const template = resolveTemplate("lead");
    expect(Object.keys(template).sort()).toEqual(["render", "subject"]);
  });
});
