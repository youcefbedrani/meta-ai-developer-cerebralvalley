"use client";

import { Bot, Check, Copy, Loader2, MessageSquarePlus, Send, Sparkles, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCopilotThreadAction, sendCopilotMessageAction } from "@/app/(app)/app/(founder)/copilot/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = { id: string; group: string; label: string; description: string; placeholder: string };
type Message = { id: string; role: "user" | "assistant"; content: string; cached: boolean; pending?: boolean };
type Usage = { day: { used: number; limit: number }; month: { used: number; limit: number } };

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export function CopilotChat(props: {
  tools: Tool[];
  toolId: string;
  threadId: string | null;
  messages: Message[];
  threads: { id: string; title: string; tool: string }[];
  projects: { id: string; name: string }[];
  projectId: string | null;
  usage: Usage;
  balance: number;
  cost: number;
  plan: string;
  aiReady: boolean;
  mock: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(props.messages);
  const [threadId, setThreadId] = useState(props.threadId);
  const [projectId, setProjectId] = useState(props.projectId);
  const [usage, setUsage] = useState(props.usage);
  const [balance, setBalance] = useState(props.balance);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const tool = props.tools.find((t) => t.id === props.toolId) ?? props.tools[0];
  const groups = [...new Set(props.tools.map((t) => t.group))];
  const dayLeft = Math.max(0, usage.day.limit - usage.day.used);
  const blocked = !props.aiReady || dayLeft <= 0 || usage.month.used >= usage.month.limit;

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages.length]);

  function send(message = text) {
    const content = message.trim();
    if (content.length < 2 || pending) return;
    setText("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content, cached: false }, { id: "pending", role: "assistant", content: "", cached: false, pending: true }]);
    start(async () => {
      const r = await sendCopilotMessageAction({ tool: tool.id, projectId, threadId, message: content });
      if (!r.ok) {
        setMessages((m) => m.filter((x) => x.id !== "pending"));
        setText(content);
        toast.error(r.error);
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== "pending"), { ...r.data.message }]);
      setUsage(r.data.usage);
      if (!r.data.message.cached) setBalance((b) => b - props.cost);
      if (!threadId) {
        setThreadId(r.data.threadId);
        window.history.replaceState(null, "", `/app/copilot?thread=${r.data.threadId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Tools and history */}
      <aside className="space-y-5">
        <Link href="/app/copilot" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted/50">
          <MessageSquarePlus className="size-4" /> New conversation
        </Link>
        <nav aria-label="Copilot tools" className="space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g}</p>
              <ul className="mt-1 space-y-0.5">
                {props.tools.filter((t) => t.group === g).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/app/copilot?tool=${t.id}${projectId ? `&project=${projectId}` : ""}`}
                      aria-current={t.id === tool.id && !threadId ? "page" : undefined}
                      className={cn("block rounded-lg px-2 py-1.5 text-sm transition-colors", t.id === tool.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {props.threads.length ? (
          <div>
            <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recent</p>
            <ul className="mt-1 space-y-0.5">
              {props.threads.map((t) => (
                <li key={t.id} className="group flex items-center gap-1">
                  <Link href={`/app/copilot?thread=${t.id}`} className={cn("min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm", t.id === threadId ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    {t.title}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete “${t.title}”`}
                    className="rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                    onClick={() => start(async () => { const r = await deleteCopilotThreadAction(t.id); if (!r.ok) toast.error(r.error); else if (t.id === threadId) router.push("/app/copilot"); else router.refresh(); })}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      {/* Conversation */}
      <section className="surface flex min-h-[70vh] flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><Sparkles className="size-4" /></span>
            <div>
              <h1 className="font-semibold">{tool.label}</h1>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Project</span>
            <select
              value={projectId ?? ""}
              disabled={!!threadId}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="h-9 max-w-52 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-60"
              title={threadId ? "A conversation keeps the project it started with" : "The Copilot uses a short brief of this project"}
            >
              <option value="">No project</option>
              {props.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6" aria-live="polite">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-lg py-8 text-center">
              <Bot className="mx-auto size-9 text-primary" />
              <p className="mt-3 font-medium">What should we write today?</p>
              <p className="mt-1 text-sm text-muted-foreground">{projectId ? "I'll use a short brief of your project: your customer, their words and your brand voice." : "Pick a project above so answers use your customer and brand."}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {[tool.placeholder, ...props.tools.filter((t) => t.id !== tool.id).slice(0, 2).map((t) => t.placeholder)].map((p) => (
                  <button key={p} type="button" disabled={blocked || pending} onClick={() => (p === tool.placeholder ? send(p) : setText(p))} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:border-primary/50 hover:bg-primary/5">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} m={m} />)
          )}
          <div ref={end} />
        </div>

        <footer className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="copilot-input" className="sr-only">Message</label>
            <textarea
              id="copilot-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              maxLength={6000}
              placeholder={blocked ? (props.aiReady ? "You've reached your AI allowance for now." : "AI isn't configured yet.") : tool.placeholder}
              disabled={blocked}
              className="max-h-48 min-h-12 flex-1 resize-y rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-3 focus:ring-ring/40 disabled:opacity-60"
            />
            <Button type="submit" variant="gradient" className="h-12 px-4" disabled={blocked || pending || text.trim().length < 2} aria-label="Send">
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>{props.cost} credit per message · repeated questions are free · {balance.toLocaleString()} credits left{props.mock ? " · mock mode" : ""}</span>
            <UsageMeter usage={usage} plan={props.plan} />
          </div>
        </footer>
      </section>
    </div>
  );
}

function UsageMeter({ usage, plan }: { usage: Usage; plan: string }) {
  const pct = usage.day.limit ? Math.min(100, Math.round((usage.day.used / usage.day.limit) * 100)) : 100;
  return (
    <span className="flex items-center gap-2" title={`This month: ${fmt(usage.month.used)} of ${fmt(usage.month.limit)} tokens`}>
      <Zap className="size-3.5" />
      <span>AI today: {fmt(usage.day.used)} / {fmt(usage.day.limit)}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="AI used today" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
      </span>
      {pct >= 80 && plan !== "studio" ? <Link href="/app/settings#billing" className="font-medium text-primary hover:underline">More</Link> : null}
    </span>
  );
}

function Bubble({ m }: { m: Message }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{m.content}</p>
      </div>
    );
  }
  if (m.pending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-brand-gradient text-white"><Sparkles className="size-3.5" /></span>
        <span className="shimmer rounded-lg px-3 py-1.5">Writing…</span>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white"><Sparkles className="size-3.5" /></span>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed">
          <Markdown text={m.content} />
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(m.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => toast.error("Couldn't copy"))}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
          {m.cached ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">From your history · free</span> : null}
        </div>
      </div>
    </div>
  );
}

/** Minimal, safe Markdown: headings, lists, bold, italics and inline code. Builds React nodes; never injects HTML. */
function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length} className="my-2 first:mt-0 last:mb-0">{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length} className="my-2 list-decimal space-y-1 pl-5">{items}</ol> : <ul key={blocks.length} className="my-2 list-disc space-y-1 pl-5">{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push(<p key={blocks.length} className="mb-1 mt-4 font-semibold first:mt-0">{inline(h[2])}</p>);
    } else if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}

function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Underscore italics only at word edges, so names like AI_PROVIDER stay as they are.
  const re = /(\*\*[^*]+\*\*|`[^`]+`|(?<![\w])_[^_\n]+_(?![\w])|(?<![\w*])\*[^*\n]+\*(?![\w*]))/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={out.length}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={out.length} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={out.length}>{t.slice(1, -1)}</em>);
    last = m.index! + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
