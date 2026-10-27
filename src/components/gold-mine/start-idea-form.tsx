"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { startFromIdeaAction } from "@/app/(app)/app/(founder)/gold-mine/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StartIdeaForm() {
  const [niche, setNiche] = useState("");
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await startFromIdeaAction({ niche, ideaDescription: idea });
          if (r && !r.ok) setError(r.fieldErrors?.niche?.[0] ?? r.error);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="gm-niche">Niche or customer</Label>
        <Input id="gm-niche" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. client reporting for marketing agencies" className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gm-idea">Your idea (optional)</Label>
        <Textarea id="gm-idea" rows={2} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="What you'd build, in a sentence or two" />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="gradient" className="h-10 w-full px-4" disabled={pending || niche.trim().length < 3}>
        {pending ? <Loader2 className="animate-spin" /> : null} Check demand for my idea <ArrowRight />
      </Button>
    </form>
  );
}
