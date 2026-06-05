import { notFound } from "next/navigation";

import { getAdminOrderDetail } from "@/lib/admin/orders";
import { OrderDetail } from "@/components/admin/order-detail";

/** Always live — never statically cached (mirrors the queue). */
export const dynamic = "force-dynamic";

/**
 * `/admin/orders/[id]` — the order detail view (PRD §11.1). Reads one order's
 * full picture via the service-role data layer (state-machine history, intake,
 * generated content, compliance violations, deployment logs) and renders it
 * inside the `/admin` console shell. A bad id renders `not-found`; a failed read
 * bubbles to the segment's error boundary (`../error.tsx`). The admin gate is
 * inherited from the `/admin` layout.
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminOrderDetail(id);
  if (!detail) notFound();
  return <OrderDetail detail={detail} />;
}
