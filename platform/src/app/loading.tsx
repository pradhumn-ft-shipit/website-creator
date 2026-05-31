import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="text-muted-foreground flex flex-1 items-center justify-center py-24"
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
    </div>
  );
}
