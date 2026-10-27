"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfigErrorNotice } from "@/components/config-error";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/action-result";

/** Runs a server action with fixed args, shows config / needs-more-data / generic errors inline, then refreshes. */
export function ActionButton<A extends unknown[]>({
  action,
  args,
  children,
  success,
  variant = "gradient",
  disabled,
  className,
}: {
  /** A server action (passed by reference) and the serializable arguments to call it with. */
  action: (...args: A) => Promise<ActionResult<unknown>>;
  args: A;
  children: React.ReactNode;
  success?: string;
  variant?: "gradient" | "outline" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; missing?: string[]; needsData?: boolean } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        className={className ?? (variant === "gradient" ? "h-10 px-5" : "rounded-[10px]")}
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await action(...args);
            if (r && !r.ok) {
              setError({ message: r.error, missing: r.code === "config" ? r.missing : undefined, needsData: r.code === "needs_more_data" });
              return;
            }
            if (success) toast.success(success);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {children}
      </Button>
      {error?.missing ? <ConfigErrorNotice title={error.message} missing={error.missing} /> : null}
      {error && !error.missing ? (
        <p role="alert" className={error.needsData ? "rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning" : "text-sm text-destructive"}>
          {error.needsData ? "Needs more data: " : ""}
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
