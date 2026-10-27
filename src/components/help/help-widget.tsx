"use client";

import { ArrowRight, BookOpen, Compass, LifeBuoy, Loader2, Rocket, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { askHelpAction } from "@/app/(app)/app/(founder)/help/actions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MVP_PLAYBOOK } from "@/lib/resources/mvp-playbook";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; text: string; links?: { label: string; href: string }[]; error?: boolean };

const SUGGESTIONS = ["What's my next step?", "Which MVP should I build first?", "How do I validate my idea quickly?", "How do I get my first customers?"];

/** Floating "Help" button: ask the assistant about your idea, or jump to a guide. */
export function HelpWidget({ cost }: { cost: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, pending]);

  const ask = (question: string) => {
    const q = question.trim();
    if (q.length < 3 || pending) return;
    const history = messages.filter((m) => !m.error).slice(-8).map(({ role, text }) => ({ role, text: text.slice(0, 3000) }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    start(async () => {
      const r = await askHelpAction({ question: q, history, pathname });
      setMessages((m) => [...m, r.ok ? { role: "assistant", text: r.data.answer, links: r.data.links } : { role: "assistant", text: r.error, error: true }]);
    });
  };

  // The AI Copilot page is a full assistant already; the floating button would only cover its footer.
  if (pathname.startsWith("/app/copilot")) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-[var(--plum)] pl-4 pr-5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(65,23,94,0.35)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
        aria-label="Open help"
      >
        <LifeBuoy className="size-5" /> Help
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-border bg-[var(--plum)] p-5 text-white">
          <SheetTitle className="flex items-center gap-2 text-white"><LifeBuoy className="size-5" /> How can we help?</SheetTitle>
          <SheetDescription className="text-white/75">Ask about your idea and your next step, or open a guide.</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="ask" className="min-h-0 flex-1 gap-0">
          <TabsList className="mx-5 mt-4 w-auto">
            <TabsTrigger value="ask"><Sparkles /> Ask</TabsTrigger>
            <TabsTrigger value="guides"><BookOpen /> Guides</TabsTrigger>
          </TabsList>

          <TabsContent value="ask" className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
              {messages.length === 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground">I know the founder journey, the MVP Playbook and, when you&apos;re viewing a project, that project&apos;s research. Try:</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => ask(s)} className="rounded-xl border border-border bg-white px-3 py-2 text-left text-sm hover:border-[var(--violet)]/50">{s}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((m, i) => (
                <div key={i} className={cn("max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm", m.role === "user" ? "ml-auto bg-[var(--plum)] text-white" : m.error ? "border border-destructive/30 bg-destructive/5 text-destructive" : "border border-border bg-white")}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  {m.links?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded-full border border-[var(--violet)]/30 bg-[var(--violet)]/5 px-2.5 py-1 text-xs font-medium text-[var(--violet)] hover:bg-[var(--violet)]/10">
                          {l.label} <ArrowRight className="size-3" />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {pending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</p> : null}
              <div ref={endRef} />
            </div>
            <form
              className="border-t border-border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <div className="flex items-end gap-2">
                <label htmlFor="help-question" className="sr-only">Your question</label>
                <textarea
                  id="help-question"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Ask anything about your idea…"
                  className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus-visible:border-[var(--violet)] focus-visible:ring-2 focus-visible:ring-[var(--violet)]/20"
                />
                <button type="submit" disabled={pending || input.trim().length < 3} aria-label="Send question" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white disabled:opacity-50">
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{cost} credit per question · AI guidance, not guarantees. Check important decisions against real evidence.</p>
            </form>
          </TabsContent>

          <TabsContent value="guides" className="overflow-y-auto p-5">
            <div className="space-y-2">
              <GuideLink href="/app/guide" icon={Compass} title="Start here" body="The 9-step journey from idea to customers, with your progress." onNavigate={() => setOpen(false)} />
              <GuideLink href={`/app/resources/${MVP_PLAYBOOK.slug}`} icon={Rocket} title={MVP_PLAYBOOK.title} body={MVP_PLAYBOOK.subtitle} onNavigate={() => setOpen(false)} />
            </div>
            <p className="mt-5 text-xs uppercase tracking-wider text-muted-foreground">MVP strategies</p>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-white">
              {MVP_PLAYBOOK.strategies.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/resources/${MVP_PLAYBOOK.slug}#strategy-${s.id}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-muted/40">
                    <span>{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{s.speed}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function GuideLink({ href, icon: Icon, title, body, onNavigate }: { href: string; icon: typeof Compass; title: string; body: string; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className="flex items-start gap-3 rounded-xl border border-border bg-white p-3 hover:border-[var(--violet)]/50">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white"><Icon className="size-4" /></span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}
