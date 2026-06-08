/**
 * Order state-machine IO layer (PRD §13.1, §13.2).
 *
 * Thin wrapper over the pure core (state-machine.ts) that reads the order's
 * current status, validates the requested transition, and persists the new
 * `status` + `state_machine_position` via the service-role client. Also owns
 * failure escalation into `admin_alerts`.
 *
 * Kept separate from Inngest so the pipeline can call these with a mocked
 * client in tests, and so the pure transition rules stay IO-free.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  type OrderState,
  assertTransition,
  positionOf,
} from "./state-machine";

type AdminClient = SupabaseClient<Database>;

/**
 * Validate + persist a transition. Returns the new state. Throws
 * IllegalTransitionError (from the core) before any write if the move is
 * illegal, so the order row is never left inconsistent.
 */
export async function transitionOrder(
  client: AdminClient,
  orderId: string,
  to: OrderState,
  note?: string,
): Promise<OrderState> {
  const { data, error } = await client
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error(
      `transitionOrder: order ${orderId} not found${
        error ? `: ${error.message}` : ""
      }`,
    );
  }

  const from = data.status as OrderState;
  // Throws IllegalTransitionError if the move is not in the table.
  const next = assertTransition(from, to);

  const { error: updateError } = await client
    .from("orders")
    .update({
      status: next,
      // 002 typed this column as text; store the ordinal index as a string.
      state_machine_position: String(positionOf(next)),
    })
    .eq("id", orderId);

  if (updateError) {
    throw new Error(
      `transitionOrder: failed to persist ${from} → ${to}: ${updateError.message}`,
    );
  }

  // Append to the order's state-machine history (033 Slice 2). Best-effort: the
  // order's status is already persisted, and history is an audit aid, not the
  // source of truth — a failed insert must not fail (or roll back) the
  // transition, same posture as escalateOrderFailure's own write errors.
  await recordStateEvent(client, orderId, from, next, note);

  return next;
}

/**
 * Append one row to `order_state_events` — the append-only transition log the
 * admin detail view reads as "state-machine history" (PRD §11.1). Non-throwing:
 * swallows its own write error so it can never mask or undo the transition that
 * already succeeded. `note` carries out-of-band context (e.g. 'admin retry').
 */
export async function recordStateEvent(
  client: AdminClient,
  orderId: string,
  fromStatus: OrderState | null,
  toStatus: OrderState,
  note?: string,
): Promise<void> {
  try {
    await client.from("order_state_events").insert({
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      note: note ?? null,
    });
  } catch {
    // Audit-log write failures are non-fatal (see transitionOrder note above).
  }
}

/**
 * Escalate a failure beyond auto-retry: write an `admin_alerts` row
 * (`type:'order_failed'`) carrying the failing step + error trace, later
 * consumed by /admin/orders (ticket 033). Non-throwing on its own write errors
 * is intentional — escalation must not mask the original failure.
 */
export async function escalateOrderFailure(
  client: AdminClient,
  orderId: string,
  err: unknown,
  step: string,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const trace = err instanceof Error ? (err.stack ?? message) : message;

  await client.from("admin_alerts").insert({
    type: "order_failed",
    order_id: orderId,
    payload_json: { step, message, trace },
  });
}
