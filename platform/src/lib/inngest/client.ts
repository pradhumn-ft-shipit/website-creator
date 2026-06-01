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
};

export const inngest = new Inngest({
  id: "wri-platform",
  schemas: new EventSchemas().fromRecord<Events>(),
});
