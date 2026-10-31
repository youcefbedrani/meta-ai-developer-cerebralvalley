"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "autopilot", label: "Autopilot" },
  { slug: "research", label: "Research" },
  { slug: "competitors", label: "Competitors" },
  { slug: "language", label: "Market voices" },
  { slug: "validation", label: "Validation" },
  { slug: "review", label: "Page review" },
  { slug: "plan", label: "Plan" },
  { slug: "playbook", label: "Launch playbook" },
  { slug: "brand", label: "Brand" },
  { slug: "design", label: "Design" },
  { slug: "marketing", label: "Marketing" },
  { slug: "videos", label: "Launch videos" },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/app/projects/${projectId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Project sections">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground",
            )}
          >
            {t.label}
            {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-gradient" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
