import { NextResponse } from "next/server";

/**
 * The WRI API envelope — the single, central place every API response is shaped.
 *
 * Contract (CLAUDE.md / state/decisions.md):
 *   success → { data: <payload>, error: null }
 *   failure → { data: null, error: { message, code } }
 *
 * Route handlers return a payload (or a NextResponse, if they need custom
 * headers/status) and throw `AppError` for *expected* failures. They never
 * build the envelope by hand — `apiHandler` is the only thing that does.
 */

export type ApiEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; code: string } };

/**
 * An expected, client-meaningful failure. Throw this from a route handler when
 * the request can't be fulfilled for a reason the caller should see (bad input,
 * not found, unauthorized, rate-limited, …). Anything else that throws is
 * treated as an unexpected server error and never leaks its message.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

function successEnvelope<T>(data: T): ApiEnvelope<T> {
  return { data, error: null };
}

function errorEnvelope(message: string, code: string): ApiEnvelope<never> {
  return { data: null, error: { message, code } };
}

/** Route handler signature: receive the request, return a payload (or a built NextResponse). */
type RouteHandler<T> = (
  request: Request,
  context: unknown,
) => Promise<T | NextResponse> | T | NextResponse;

/**
 * Wrap a route handler so its result is always emitted as the `{data,error}`
 * envelope. Pass-through for handlers that return a `NextResponse` directly
 * (e.g. redirects, custom headers) — they own their own response.
 *
 * Usage:
 *   export const GET = apiHandler(async () => ({ status: "ok" }));
 */
export function apiHandler<T>(handler: RouteHandler<T>) {
  return async (request: Request, context: unknown): Promise<NextResponse> => {
    try {
      const result = await handler(request, context);
      if (result instanceof NextResponse) return result;
      return NextResponse.json(successEnvelope(result), { status: 200 });
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(errorEnvelope(err.message, err.code), {
          status: err.status,
        });
      }
      // Unexpected — log server-side, return an opaque envelope. Never leak details.
      console.error("[apiHandler] unexpected error:", err);
      return NextResponse.json(
        errorEnvelope("Something went wrong. Please try again.", "internal_error"),
        { status: 500 },
      );
    }
  };
}
