import { requireAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/shell";

/**
 * Gate for every `/admin/*` route (PRD §11). `requireAdmin` resolves the
 * session and applies the env-allowlist gate: unauthenticated → /login,
 * authenticated-but-not-admin → 404 (a regular advisor never learns the admin
 * surface exists). Only WRI team members reach the console.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return <AdminShell email={user.email ?? ""}>{children}</AdminShell>;
}
