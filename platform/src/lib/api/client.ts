import type { ApiEnvelope } from "./envelope";

/**
 * Browser-side POST that always resolves to the `{data,error}` envelope — the
 * mirror of `apiHandler` on the client. A network failure (offline, DNS) is
 * normalized into an envelope error so callers branch on one shape only.
 */
export async function postJson<T>(
  path: string,
  body: unknown,
): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return {
      data: null,
      error: {
        message: "Couldn't reach the server. Check your connection and try again.",
        code: "network_error",
      },
    };
  }
}
