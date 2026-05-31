import { describe, expect, it } from "vitest";

import { validateEmail, validatePassword } from "./validation";

describe("validateEmail", () => {
  it("accepts a well-formed address", () => {
    expect(validateEmail("advisor@example.com")).toBeNull();
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateEmail("  advisor@example.com  ")).toBeNull();
  });

  it("rejects an empty value with a human-readable message", () => {
    expect(validateEmail("")).toBe("Enter your email address.");
    expect(validateEmail("   ")).toBe("Enter your email address.");
  });

  it.each(["advisor", "advisor@", "@example.com", "advisor@example", "a b@x.com"])(
    "rejects malformed address %j",
    (bad) => {
      expect(validateEmail(bad)).toBe("Enter a valid email address.");
    },
  );
});

describe("validatePassword", () => {
  it("accepts a password at the minimum length", () => {
    expect(validatePassword("hunter22")).toBeNull();
  });

  it("rejects an empty value", () => {
    expect(validatePassword("")).toBe("Enter a password.");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validatePassword("short")).toBe(
      "Use at least 8 characters.",
    );
  });
});
