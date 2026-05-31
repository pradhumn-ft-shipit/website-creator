import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";

/**
 * Authenticated shell for every /dashboard/* route. Middleware already guards
 * the segment; here we resolve who's signed in (fail closed if the session
 * vanished) and their firm name for the sidebar identity, then hand off to the
 * client shell.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const supabase = await createClient();
  // RLS scopes this to the signed-in user's own account.
  const { data: account } = await supabase
    .from("accounts")
    .select("firm_name")
    .limit(1)
    .maybeSingle();

  return (
    <DashboardShell firmName={account?.firm_name ?? null} email={user.email ?? ""}>
      {children}
    </DashboardShell>
  );
}
