"use client";

import { ArrowRight, BadgeCheck, Coins, Compass, Hammer, Lightbulb, Rocket, SearchCheck, Sparkles, TvMinimalPlay } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismissWelcomeAction } from "@/app/(app)/app/(founder)/welcome-actions";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const OLD_VS_NEW = [
  { icon: TvMinimalPlay, old: "Hundreds of hours of YouTube videos", now: "One step-by-step path that always shows your next move", nowIcon: Compass },
  { icon: Coins, old: "Thousands of dollars on mentors and courses", now: "AI that researches, plans, designs and writes with you, free to start", nowIcon: Sparkles },
  { icon: Lightbulb, old: "Scattered, conflicting advice and ideas", now: "Real evidence: sourced facts, real customer quotes, competitor prices", nowIcon: BadgeCheck },
];

const PATH = [
  { icon: Lightbulb, label: "Find an idea" },
  { icon: SearchCheck, label: "Validate it" },
  { icon: Hammer, label: "Design & build" },
  { icon: Rocket, label: "Launch & grow" },
];

/** One-time welcome for new founders: why Startum, and the path from idea to launch. */
export function WelcomeModal({ name }: { name: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [, start] = useTransition();
  const first = name?.trim().split(/\s+/)[0];

  const close = (goToGuide: boolean) => {
    setOpen(false);
    start(async () => {
      await dismissWelcomeAction();
      if (goToGuide) router.push("/app/guide");
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close(false)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-2xl" showCloseButton>
        <div className="ambient-glow rounded-t-xl px-6 pt-7 pb-5 sm:px-8">
          <div className="animate-pop flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <LogoMark animated className="size-6" /> Welcome to Startum{first ? `, ${first}` : ""}
          </div>
          <DialogTitle className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Skip the hundreds of hours. <span className="text-gradient">Build your SaaS here.</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Before you spend months on YouTube tutorials, pay thousands for mentors and courses, and get lost in conflicting advice: here is one clear path, with AI helping you at every step, from your first idea to launching your SaaS or micro-SaaS.
          </DialogDescription>
        </div>

        <div className="px-6 sm:px-8">
          <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
            <span>The old way</span>
            <span />
            <span className="text-primary">With Startum</span>
          </div>
          <ul className="stagger mt-2 space-y-4 sm:space-y-2">
            {OLD_VS_NEW.map((row) => (
              <li key={row.old} className="grid items-center gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
                <span className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground line-through decoration-muted-foreground/40">
                  <row.icon className="mt-0.5 size-4 shrink-0" /> {row.old}
                </span>
                <ArrowRight className="mx-auto size-4 rotate-90 text-primary sm:rotate-0" aria-hidden="true" />
                <span className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium">
                  <row.nowIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {row.now}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your path, A to launch</p>
          <ol className="stagger mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PATH.map((step, i) => (
              <li key={step.label} className="flex items-center gap-2 rounded-xl border border-border p-2.5 text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white"><step.icon className="size-3.5" /></span>
                <span><span className="text-xs text-muted-foreground">{i + 1}.</span> {step.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Startum gives you the path, the tools and the evidence. Real customers decide if an idea works, so you&apos;ll test with them before you build.</p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          <Button variant="ghost" onClick={() => close(false)}>I&apos;ll explore on my own</Button>
          <Button variant="gradient" className="h-10 px-5" onClick={() => close(true)}>
            Start my journey <ArrowRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
