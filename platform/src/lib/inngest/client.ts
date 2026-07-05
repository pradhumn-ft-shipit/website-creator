/**
 * Inngest client (PRD §9.2). Single client for the platform; the generation
 * pipeline is triggered by the `order.created` event.
 *
 * The Next.js API layer only *enqueues* jobs — long work (scrape, generate,
 * build, deploy) runs inside Inngest steps, never in a Vercel function.
 */
import { EventSchemas, Inngest } from "inngest";

/** Typed event map. `order.created` carries the order + account to build. */
export type Events = {
  "order.created": {
    data: {
      orderId: string;
      accountId: string;
    };
  };
  /**
   * Emitted by the /admin/compliance publish flow (035): a new ruleset version
   * was published; re-validate all live sites built against an older version and
   * queue failures into /admin/compliance/violations (034).
   */
  "compliance.revalidate": {
    data: {
      industry: string;
      subIndustry: string | null;
      version: string;
      /** Path-style version, e.g. "ria/v1.1". */
      versionString: string;
    };
  };
};

export const inngest = new Inngest({
  id: "wri-platform",
  schemas: new EventSchemas().fromRecord<Events>(),
});
