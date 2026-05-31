import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { apiHandler, AppError } from "./envelope";

const req = () => new Request("http://localhost/api/test");

describe("apiHandler envelope", () => {
  it("wraps a returned payload as { data, error: null } with status 200", async () => {
    const route = apiHandler(async () => ({ status: "ok" }));
    const res = await route(req(), undefined);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok" }, error: null });
  });

  it("maps a thrown AppError to { data: null, error: { message, code } } with its status", async () => {
    const route = apiHandler(async () => {
      throw new AppError("Advisor not found", "not_found", 404);
    });
    const res = await route(req(), undefined);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      data: null,
      error: { message: "Advisor not found", code: "not_found" },
    });
  });

  it("defaults AppError status to 400", async () => {
    const route = apiHandler(async () => {
      throw new AppError("Bad input", "validation_error");
    });
    const res = await route(req(), undefined);
    expect(res.status).toBe(400);
  });

  it("hides unexpected errors behind an opaque 500 envelope", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = apiHandler(async () => {
      throw new Error("DATABASE_URL leaked secret");
    });
    const res = await route(req(), undefined);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret");
    spy.mockRestore();
  });

  it("passes a returned NextResponse through untouched", async () => {
    const route = apiHandler(async () =>
      NextResponse.json({ custom: true }, { status: 201 }),
    );
    const res = await route(req(), undefined);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ custom: true });
  });
});
