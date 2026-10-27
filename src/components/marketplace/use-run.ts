"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action-result";

/** Runs a server action, toasts the outcome and refreshes the page. */
export function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, success?: string, after?: (data: T) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(Object.values(r.fieldErrors ?? {})[0]?.[0] ?? r.error);
        return;
      }
      if (success) toast.success(success);
      if (after) after(r.data);
      else router.refresh();
    });
  return { run, pending, router };
}
