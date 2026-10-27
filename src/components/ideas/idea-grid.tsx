"use client";

import { GitCompare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ComplexityBadge } from "./complexity-badge";
import { IdeaActions } from "./idea-actions";

export type IdeaCardData = {
  id: string;
  title: string;
  oneLiner: string;
  targetCustomer: string;
  complexity: "low" | "medium" | "high";
  status: "generated" | "saved" | "dismissed" | "converted";
  projectId: string | null;
  createdAt: string;
};

export function IdeaGrid({ ideas }: { ideas: IdeaCardData[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  return (
    <div className="space-y-4">
      <div className="stagger grid gap-4 md:grid-cols-2">
        {ideas.map((idea) => {
          const isSel = selected.includes(idea.id);
          return (
            <article key={idea.id} className={cn("surface flex flex-col gap-3 p-5 transition-colors", isSel && "border-primary/60")}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/app/ideas/${idea.id}`} className="font-medium leading-snug hover:underline">
                  {idea.title}
                </Link>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={isSel} onChange={() => toggle(idea.id)} className="size-3.5 accent-violet-500" aria-label={`Compare ${idea.title}`} />
                  Compare
                </label>
              </div>
              <p className="text-sm text-muted-foreground">{idea.oneLiner}</p>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground/80">For:</span> {idea.targetCustomer}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ComplexityBadge value={idea.complexity} />
                {idea.status !== "generated" ? <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">{idea.status}</span> : null}
              </div>
              <div className="mt-auto pt-2">
                <IdeaActions ideaId={idea.id} status={idea.status} projectId={idea.projectId} compact />
              </div>
            </article>
          );
        })}
      </div>

      {selected.length ? (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-popover/95 py-2 pl-5 pr-2 shadow-glow backdrop-blur">
          <span className="text-sm">{selected.length} selected {selected.length < 2 ? "· pick at least 2" : ""}</span>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setSelected([])}>
            Clear
          </button>
          <Link
            href={`/app/ideas/compare?ids=${selected.join(",")}`}
            aria-disabled={selected.length < 2}
            className={cn(buttonVariants({ variant: "gradient" }), "h-9 px-4", selected.length < 2 && "pointer-events-none opacity-50")}
          >
            <GitCompare /> Compare
          </Link>
        </div>
      ) : null}
    </div>
  );
}
