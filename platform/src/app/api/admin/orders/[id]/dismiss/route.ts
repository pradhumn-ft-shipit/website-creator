import { apiHandler } from "@/lib/api/envelope";
import { assertAdmin } from "@/lib/admin/auth";
import { dismissOrderAlert } from "@/lib/admin/orders";

/**
 * POST /api/admin/orders/:id/dismiss — resolve an order's open admin alert
 * without re-running the build (PRD §11.1). Admin-only. Used when the failure
 * was handled out-of-band or was a false alarm.
 */
export const POST = apiHandler(async (_request, context) => {
  await assertAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await dismissOrderAlert(id);
  return { status: "dismissed" };
});
