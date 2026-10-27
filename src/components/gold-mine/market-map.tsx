"use client";

import { ChevronRight, Loader2, Pickaxe, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { chooseNicheAction, expandNodeAction } from "@/app/(app)/app/(founder)/gold-mine/actions";
import { Button } from "@/components/ui/button";
import type { MarketNode } from "@/lib/validation/gold-mine";
import { cn } from "@/lib/utils";

/** Market tree: Health / Wealth / Relationships, expanded one level at a time on click. */
export function MarketMap({ nodes, cost, maxDepth, disabled }: { nodes: MarketNode[]; cost: number; maxDepth: number; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.expanded).map((n) => n.id)));
  const children = (id: string | null) => nodes.filter((n) => n.parentId === id);

  const expand = (n: MarketNode) => {
    if (n.expanded) {
      setOpen((o) => {
        const next = new Set(o);
        if (next.has(n.id)) next.delete(n.id);
        else next.add(n.id);
        return next;
      });
      return;
    }
    setBusy(n.id);
    start(async () => {
      const r = await expandNodeAction(n.id);
      setBusy(null);
      if (!r.ok) return void toast.error(r.error);
      setOpen((o) => new Set(o).add(n.id));
    });
  };

  const choose = (n: MarketNode) => {
    setBusy(`choose:${n.id}`);
    start(async () => {
      const r = await chooseNicheAction(n.id);
      setBusy(null);
      if (r && !r.ok) toast.error(r.error);
    });
  };

  const renderNode = (n: MarketNode) => {
    const kids = children(n.id);
    const isOpen = open.has(n.id) && n.expanded;
    return (
      <li key={n.id}>
        <div className={cn("group flex items-start gap-3 rounded-xl border border-border bg-white p-3 transition-colors hover:border-[var(--violet)]/40", n.depth === 0 && "shadow-hard-sm")}>
          <button
            type="button"
            onClick={() => expand(n)}
            disabled={pending || disabled || (!n.expanded && n.depth >= maxDepth)}
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-40"
            aria-label={n.expanded ? (isOpen ? `Collapse ${n.label}` : `Show ${n.label}`) : `Expand ${n.label}`}
            aria-expanded={isOpen}
          >
            {busy === n.id ? <Loader2 className="size-3.5 animate-spin" /> : n.expanded ? <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} /> : <Plus className="size-3.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={cn("font-medium", n.depth === 0 && "text-base")}>{n.label}</p>
            <p className="text-xs text-muted-foreground">{n.description}</p>
            {!n.expanded && n.depth < maxDepth ? <p className="mt-1 text-[11px] text-muted-foreground">Expand · {cost} credit</p> : null}
          </div>
          {n.depth > 0 ? (
            <Button variant="outline" size="sm" className="shrink-0 rounded-[10px]" disabled={pending || disabled} onClick={() => choose(n)}>
              {busy === `choose:${n.id}` ? <Loader2 className="animate-spin" /> : <Pickaxe />} Choose niche
            </Button>
          ) : null}
        </div>
        {isOpen && kids.length ? <ul className="ml-4 mt-2 space-y-2 border-l border-dashed border-border pl-4">{kids.map(renderNode)}</ul> : null}
      </li>
    );
  };

  return <ul className="space-y-3">{children(null).map(renderNode)}</ul>;
}
