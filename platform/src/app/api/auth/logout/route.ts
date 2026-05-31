import { apiHandler } from "@/lib/api/envelope";
import { signOutAdvisor } from "@/lib/auth/service";
import { createClient } from "@/lib/supabase/server";

/** POST /api/auth/logout — clears the session cookies. */
export const POST = apiHandler(async () => {
  const supabase = await createClient();
  return signOutAdvisor(supabase);
});
