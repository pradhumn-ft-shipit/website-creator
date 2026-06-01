import { apiHandler } from "@/lib/api/envelope";
import { readJson } from "@/lib/api/request";
import { updateNotificationPrefs } from "@/lib/account/service";

/**
 * POST /api/account/notifications — { leadFrequency, systemAlerts }.
 * Persists the advisor's notification preferences (PRD §12.9): how often we email
 * about new leads, and whether they receive system/operational alerts.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  return updateNotificationPrefs({
    leadFrequency: body.leadFrequency,
    systemAlerts: body.systemAlerts,
  });
});
