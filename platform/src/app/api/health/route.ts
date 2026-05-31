import { apiHandler } from "@/lib/api/envelope";
import { getHealthStatus } from "@/lib/health";

/**
 * Liveness probe and the canonical example of the `{data,error}` envelope.
 * Returns a payload; `apiHandler` shapes the response. No hand-built envelope.
 */
export const GET = apiHandler(async () => getHealthStatus());
