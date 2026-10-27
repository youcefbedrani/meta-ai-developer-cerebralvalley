"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Splits the marketing plan into tabs; panels are rendered on the server and passed in. */
export function PlanTabs({ tabs }: { tabs: { value: string; label: string; content: ReactNode }[] }) {
  return (
    <Tabs defaultValue={tabs[0]?.value} className="gap-5">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList className="h-10 rounded-xl border border-border bg-white p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="rounded-lg px-3.5 data-active:bg-[var(--plum)] data-active:text-white">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="space-y-6">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
