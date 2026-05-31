import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth helpers for Server Components. Middleware already guards routes, but a
 * page should still resolve *who* the user is (and fail closed if the session
 * vanished between the middleware check and render).
 */

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Resolve the current user or redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
