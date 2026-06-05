import Link from "next/link";
import { PackageX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * §7.6 not-found state for an unknown order id (admin can be lower-fidelity,
 * never broken — §7.10). Rendered by the detail page's `notFound()`.
 */
export default function AdminOrderNotFound() {
  return (
    <Card className="flex flex-col items-center gap-4 p-10 text-center">
      <span className="bg-muted flex size-11 items-center justify-center rounded-2xl">
        <PackageX className="text-muted-foreground size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-semibold">Order not found</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          No order matches that id. It may have been removed, or the link is stale.
        </p>
      </div>
      <Button asChild>
        <Link href="/admin/orders">Back to orders</Link>
      </Button>
    </Card>
  );
}
