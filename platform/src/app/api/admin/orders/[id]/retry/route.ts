import { apiHandler } from "@/lib/api/envelope";
import { assertAdmin } from "@/lib/admin/auth";
import { retryOrderById } from "@/lib/admin/orders";

/**
 * POST /api/admin/orders/:id/retry — one-click recovery (PRD §11.1, §13.2).
 * Admin-only. Resets the failed order, bumps its retry count, resolves its open
 * alert, and re-enqueues the build pipeline.
 */
export const POST = apiHandler(async (_request, context) => {
  await assertAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  return retryOrderById(id);
});
