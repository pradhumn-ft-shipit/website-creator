import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
      <span className="bg-accent text-accent-foreground inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
        <ShieldCheck className="size-3.5" aria-hidden />
        Compliance-aware websites for RIAs
      </span>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Websites for Regulatory Industries
      </h1>
      <p className="text-muted-foreground mt-4 max-w-xl text-lg">
        Done-for-you, hosted, compliance-aware websites for SEC- and
        state-registered investment advisers — launched in about fifteen
        minutes.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/health">
            View system health
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </main>
  );
}
