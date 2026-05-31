import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  requestPasswordReset,
  signInAdvisor,
  signOutAdvisor,
  signUpAdvisor,
  updatePassword,
  type AuthClient,
} from "./service";

/** Minimal Supabase-auth stub; each test supplies the call results it cares about. */
function fakeClient(auth: Partial<AuthClient["auth"]>): AuthClient {
  return { auth: auth as AuthClient["auth"] };
}

describe("signUpAdvisor", () => {
  it("returns verification_sent for a brand-new email", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
      error: null,
    });
    const result = await signUpAdvisor(fakeClient({ signUp }), {
      email: "new@example.com",
      password: "hunter22",
      emailRedirectTo: "http://localhost:3000/api/auth/callback",
    });
    expect(result).toEqual({ status: "verification_sent" });
    expect(signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "hunter22",
      options: { emailRedirectTo: "http://localhost:3000/api/auth/callback" },
    });
  });

  it("detects an already-registered email by the empty identities array (§4.7)", async () => {
    // Supabase obfuscates duplicate signups: no error, user with identities: [].
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "u1", identities: [] }, session: null },
      error: null,
    });
    const result = await signUpAdvisor(fakeClient({ signUp }), {
      email: "existing@example.com",
      password: "hunter22",
      emailRedirectTo: "http://localhost:3000/api/auth/callback",
    });
    expect(result).toEqual({ status: "already_registered" });
  });

  it("rejects invalid input before calling Supabase", async () => {
    const signUp = vi.fn();
    await expect(
      signUpAdvisor(fakeClient({ signUp }), {
        email: "not-an-email",
        password: "hunter22",
        emailRedirectTo: "x",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects a too-short password before calling Supabase", async () => {
    const signUp = vi.fn();
    await expect(
      signUpAdvisor(fakeClient({ signUp }), {
        email: "new@example.com",
        password: "short",
        emailRedirectTo: "x",
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("signInAdvisor", () => {
  it("returns the user id on success", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t" } },
      error: null,
    });
    const result = await signInAdvisor(fakeClient({ signInWithPassword }), {
      email: "advisor@example.com",
      password: "hunter22",
    });
    expect(result).toEqual({ userId: "u1" });
  });

  it("maps an unconfirmed email to a verify-first error", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email not confirmed", status: 400, code: "email_not_confirmed" },
    });
    await expect(
      signInAdvisor(fakeClient({ signInWithPassword }), {
        email: "advisor@example.com",
        password: "hunter22",
      }),
    ).rejects.toMatchObject({ code: "email_not_confirmed", status: 403 });
  });

  it("maps bad credentials to a generic error (no enumeration)", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials" },
    });
    await expect(
      signInAdvisor(fakeClient({ signInWithPassword }), {
        email: "advisor@example.com",
        password: "wrongpass1",
      }),
    ).rejects.toMatchObject({ code: "invalid_credentials", status: 401 });
  });
});

describe("requestPasswordReset", () => {
  it("reports sent even when the address is unknown (no enumeration)", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    const result = await requestPasswordReset(
      fakeClient({ resetPasswordForEmail }),
      { email: "maybe@example.com", redirectTo: "http://localhost:3000/api/auth/callback?next=/update-password" },
    );
    expect(result).toEqual({ status: "sent" });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("maybe@example.com", {
      redirectTo: "http://localhost:3000/api/auth/callback?next=/update-password",
    });
  });

  it("surfaces a rate-limit error", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rate limited", status: 429, code: "over_email_send_rate_limit" },
    });
    await expect(
      requestPasswordReset(fakeClient({ resetPasswordForEmail }), {
        email: "maybe@example.com",
        redirectTo: "x",
      }),
    ).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });
});

describe("updatePassword", () => {
  it("validates the new password before calling Supabase", async () => {
    const updateUser = vi.fn();
    await expect(
      updatePassword(fakeClient({ updateUser }), { password: "short" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password on a valid value", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const result = await updatePassword(fakeClient({ updateUser }), {
      password: "brandnew22",
    });
    expect(result).toEqual({ status: "updated" });
    expect(updateUser).toHaveBeenCalledWith({ password: "brandnew22" });
  });
});

describe("signOutAdvisor", () => {
  it("returns signed_out on success", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    expect(await signOutAdvisor(fakeClient({ signOut }))).toEqual({
      status: "signed_out",
    });
  });
});
