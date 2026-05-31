import { AppError } from "./envelope";

/**
 * Parse a JSON request body, raising an envelope-friendly `AppError` (not an
 * opaque 500) when the body is missing or malformed. Route handlers stay free
 * of repetitive try/catch around `request.json()`.
 */
export async function readJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("Expected a JSON request body.", "invalid_input", 400);
  }
}

/** Coerce an unknown JSON field to a trimmed string ("" when absent/non-string). */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
