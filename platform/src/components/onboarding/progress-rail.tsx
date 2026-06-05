import { stepProgress, type StepKey } from "@/lib/onboarding/steps";

/**
 * Thin top progress rail (§7.7). Shows "Step N of M" with a filling emerald
 * track — the only persistent chrome across the one-question-at-a-time flow.
 */
export function ProgressRail({ step }: { step: StepKey }) {
  const { current, total } = stepProgress(step);
  const pct = Math.round((current / total) * 100);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="font-display text-sm tracking-tight text-foreground">WRI</span>
        <span aria-live="polite">
          Step {current} of {total}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Onboarding progress: step ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
