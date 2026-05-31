import type { LucideIcon } from "lucide-react";

/**
 * Designed placeholder for tabs that exist in the nav but aren't built yet
 * (PRD §7.10 — lower fidelity is fine, broken/half-built screens are not).
 * Explains what the tab will do so it never reads as a dead end.
 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card/40 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-5 text-base font-semibold">{title} is coming soon</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        {description}
      </p>
    </div>
  );
}
