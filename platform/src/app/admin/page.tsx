import { redirect } from "next/navigation";

/** `/admin` lands on the primary control room (PRD §11.1 / §13.4). */
export default function AdminIndexPage() {
  redirect("/admin/orders");
}
