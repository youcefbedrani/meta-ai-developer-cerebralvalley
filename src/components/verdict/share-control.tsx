"use client";

import { Copy, Link2, Link2Off } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setSharingAction } from "@/app/(app)/app/(founder)/projects/[id]/actions";
import { Button } from "@/components/ui/button";

/** Turns the read-only report link on or off, and copies it. */
export function ShareControl({ projectId, token, appUrl }: { projectId: string; token: string | null; appUrl: string }) {
  const [current, setCurrent] = useState(token);
  const [pending, start] = useTransition();
  const url = current ? `${appUrl.replace(/\/$/, "")}/r/${current}` : null;
  const toggle = (on: boolean) =>
    start(async () => {
      const r = await setSharingAction(projectId, on);
      if (!r.ok) return void toast.error(r.error);
      setCurrent(r.data.token);
      toast.success(on ? "Share link created" : "Share link turned off");
    });

  return (
    <div className="surface p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Share the report</p>
      {url ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Anyone with this link can see the verdict, fit check and summary. No login, read only.</p>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={url} aria-label="Share link" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button size="icon" variant="outline" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"), () => toast.error("Couldn't copy. Select the link and copy it."))}>
              <Copy />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 px-0 text-muted-foreground" disabled={pending} onClick={() => toggle(false)}>
            <Link2Off /> Turn off link
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Send the verdict to a co-founder, friend or investor as a read-only link.</p>
          <Button variant="outline" className="mt-3 h-9 rounded-[10px]" disabled={pending} onClick={() => toggle(true)}>
            <Link2 /> Create share link
          </Button>
        </>
      )}
    </div>
  );
}
