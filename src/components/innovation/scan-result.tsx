"use client";

import { AlertTriangle, ArrowRight, Boxes, Building2, CircleAlert, Clock, Eye, FileText, FolderPlus, Gauge, Layers, Loader2, Plug, Rocket, ShieldCheck, Sparkles, Target, Trash2, Users, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProjectFromIdeaAction, deleteScanAction } from "@/app/(app)/app/(founder)/innovation/actions";
import { MetaMark } from "@/components/brand/hackathon-lockup";
import { Button } from "@/components/ui/button";
import { ProcessMap } from "@/components/viz/process-map";
import { cn } from "@/lib/utils";
import { IDEA_TYPE_LABEL, isEnterpriseIdea, type EnterpriseIdea, type InnovationIdea, type InnovationMode, type MediaKind, type Observation, type ProcessIdea } from "@/lib/validation/innovation";

type Status = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type Scan = { id: string; mode: InnovationMode; title: string; status: Status; stage: string | null; error: string | null; industry: string | null; notes: string; createdAt: string };
type Media = { kind: MediaKind; name: string; durationSec: number | null; transcript: string | null; pdfChars: number | null; image: string | null; frames: { src: string; atSec: number }[] };

const LEVEL = { low: "bg-emerald-50 text-emerald-700", medium: "bg-amber-50 text-amber-800", high: "bg-rose-50 text-rose-700" } as const;
// A fixed locale and time zone, so the server and the browser render the same text.
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function ScanResult({ scan, media, observation, ideas }: { scan: Scan; media: Media[]; observation: Observation | null; ideas: InnovationIdea[] }) {
  const router = useRouter();
  const running = scan.status === "queued" || scan.status === "running";
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [running, router]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--violet)]">
            {scan.mode === "enterprise" ? <Building2 className="size-3.5" /> : <Wrench className="size-3.5" />}
            {scan.mode === "enterprise" ? `Enterprise · ${scan.industry ?? ""}` : "Manual work → software"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{scan.title || "Untitled scan"}</h1>
          <p className="text-sm text-muted-foreground">{dateFmt.format(new Date(scan.createdAt))} UTC</p>
        </div>
        {!running ? (
          <Button
            variant="outline"
            className="h-9 shrink-0"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteScanAction(scan.id);
                if (!r.ok) return void toast.error(r.error);
                router.push("/app/innovation");
              })
            }
          >
            <Trash2 /> Delete
          </Button>
        ) : null}
      </header>

      {running ? <Progress stage={scan.stage} mode={scan.mode} hasMedia={media.length > 0} /> : null}
      {scan.status === "failed" || scan.status === "cancelled" ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" /> {scan.error ?? "The scan failed. Your credits were refunded."}</p>
      ) : null}

      <Evidence media={media} notes={scan.notes} />
      {observation ? <Today observation={observation} /> : null}
      {observation && scan.mode !== "enterprise" && ideas.length ? (
        <ProcessMap steps={observation.steps} ideas={ideas.filter((i): i is ProcessIdea => !isEnterpriseIdea(i))} />
      ) : null}
      {ideas.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Sparkles className="size-5 text-primary" /> {scan.mode === "enterprise" ? "Innovative systems Muse Spark proposes" : "Software that replaces it"}</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Ideas are hypotheses: estimates are labelled, and nothing counts as validated until real people say so. Start a project to research, design and test one.</p>
          <div className="space-y-4">
            {ideas.map((idea, i) => (
              <IdeaCard key={`${idea.title}-${i}`} scanId={scan.id} index={i} idea={idea} steps={observation?.steps.map((s) => s.step) ?? []} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Progress({ stage, mode, hasMedia }: { stage: string | null; mode: InnovationMode; hasMedia: boolean }) {
  const steps = [
    ...(hasMedia ? ["Reading your files"] : []),
    ...(mode === "process" || hasMedia ? ["Mapping how the work is done today"] : []),
    mode === "enterprise" ? "Designing enterprise systems" : "Proposing software ideas",
  ];
  const s = (stage ?? "").toLowerCase();
  const at = s.includes("propos") || s.includes("designing") ? steps.length - 1 : s.includes("mapping") ? steps.length - 2 : 0;
  return (
    <section className="surface ambient-glow p-5">
      <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin text-primary" /> {stage ?? "Queued"}…</p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li key={label} className={cn("rounded-full border px-3 py-1 text-xs", i < at ? "border-emerald-200 bg-emerald-50 text-emerald-700" : i === at ? "border-primary/50 bg-primary/5 text-primary" : "border-border text-muted-foreground")}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MetaMark /> Usually 1–2 minutes. You can leave this page; the scan keeps running.</p>
    </section>
  );
}

function Evidence({ media, notes }: { media: Media[]; notes: string }) {
  if (!media.length && !notes) return null;
  const frames = media.flatMap((m) => m.frames.map((f) => ({ ...f, name: m.name })));
  const photos = media.filter((m) => m.image);
  return (
    <section className="surface p-5">
      <h2 className="flex items-center gap-2 font-medium"><Eye className="size-4 text-primary" /> What you shared</h2>
      {frames.length || photos.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <figure key={`p${i}`} className="w-40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image!} alt={p.name} className="aspect-video w-full rounded-lg border border-border object-cover" />
              <figcaption className="mt-1 truncate text-[11px] text-muted-foreground">Photo {i + 1} · {p.name}</figcaption>
            </figure>
          ))}
          {frames.map((f, i) => (
            <figure key={`f${i}`} className="w-40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.src} alt={`Frame at ${fmt(f.atSec)}`} className="aspect-video w-full rounded-lg border border-border object-cover" />
              <figcaption className="mt-1 truncate text-[11px] text-muted-foreground">Frame {i + 1} · {fmt(f.atSec)}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {media.map((m, i) => (
          <li key={i} className="rounded-full border border-border px-2.5 py-1">
            {m.kind === "video" ? `🎬 ${m.name}${m.durationSec ? ` · ${fmt(m.durationSec)}` : ""}${m.transcript ? " · narration transcribed" : ""}` : m.kind === "pdf" ? `📄 ${m.name}${m.pdfChars ? ` · ${Math.round(m.pdfChars / 1000)}k characters read` : ""}` : `🖼️ ${m.name}`}
          </li>
        ))}
      </ul>
      {media.some((m) => m.transcript) ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">What was said (Muse Voice transcript)</summary>
          {media.filter((m) => m.transcript).map((m, i) => <p key={i} className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">{m.transcript}</p>)}
        </details>
      ) : null}
      {notes ? <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Your description: </span>{notes}</p> : null}
    </section>
  );
}

function Today({ observation: o }: { observation: Observation }) {
  return (
    <section className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium"><Clock className="size-4 text-primary" /> How it&apos;s done today</h2>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", o.confidence === "high" ? LEVEL.low : o.confidence === "medium" ? LEVEL.medium : LEVEL.high)}>{o.confidence} confidence</span>
      </div>
      <p className="mt-2 text-sm">{o.summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">{o.setting}{o.people.length ? ` · ${o.people.join(", ")}` : ""}</p>
      <ol className="mt-4 space-y-3">
        {o.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--plum)] text-xs font-medium text-white">{i + 1}</span>
            <div className="min-w-0 flex-1 rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{s.step}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s.evidence}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{s.howToday}</p>
              <p className="mt-1.5 flex items-start gap-1.5 text-rose-700"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {s.pain}</p>
              {s.tools.length ? <p className="mt-1.5 flex flex-wrap gap-1">{s.tools.map((t) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{t}</span>)}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MiniList title="Information handled" items={o.dataHandled} />
        <MiniList title="Bottlenecks" items={o.bottlenecks} />
        <MiniList title="Risks" items={o.risks} />
      </div>
      {o.gaps.length ? <p className="mt-3 text-xs text-muted-foreground"><b>Not visible in what you shared:</b> {o.gaps.join(" · ")}</p> : null}
    </section>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

function IdeaCard({ scanId, index, idea, steps }: { scanId: string; index: number; idea: InnovationIdea; steps: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(index === 0);
  const ent = isEnterpriseIdea(idea);
  return (
    <article className="surface overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-5 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-sm font-semibold text-white">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{idea.title}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{IDEA_TYPE_LABEL[idea.type]}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px]", LEVEL[idea.difficulty])}>{idea.difficulty} difficulty</span>
            {!ent ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">MVP {(idea as ProcessIdea).timeToMvp}</span> : null}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{idea.oneLiner}</span>
        </span>
        <ArrowRight className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open ? (
        <div className="border-t border-border p-5 pt-4">
          {ent ? <EnterpriseBody idea={idea} /> : <ProcessBody idea={idea as ProcessIdea} steps={steps} />}
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Turns this idea into a project: then research the market, design the MVP and test it with real people.</p>
            <Button
              variant="gradient"
              className="h-10 shrink-0 px-4"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createProjectFromIdeaAction(scanId, index);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Project created");
                  router.push(`/app/projects/${r.data.projectId}`);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <FolderPlus />} Start project
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Eye; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

const Bullets = ({ items }: { items: string[] }) => <ul className="list-disc space-y-0.5 pl-4">{items.map((x) => <li key={x}>{x}</li>)}</ul>;

function ProcessBody({ idea, steps }: { idea: ProcessIdea; steps: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {idea.replacesSteps.length ? (
        <div className="md:col-span-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Replaces:</span>
          {idea.replacesSteps.map((n) => <span key={n} className="rounded-full bg-[var(--plum)]/10 px-2 py-0.5 text-[var(--plum)]">{n}. {steps[n - 1] ?? `step ${n}`}</span>)}
        </div>
      ) : null}
      <Field icon={Layers} label="How it works">{idea.howItWorks}</Field>
      <Field icon={Sparkles} label="What becomes automatic">{idea.automation}</Field>
      <Field icon={Boxes} label="First version (MVP)"><Bullets items={idea.mvp} /></Field>
      <Field icon={Users} label="Who pays">{idea.whoPays}<p className="mt-1 text-muted-foreground">{idea.pricing}</p></Field>
      <Field icon={Target} label="Who else has this problem">{idea.marketBreadth}</Field>
      <Field icon={Gauge} label="Expected impact">{idea.impact}</Field>
      <Field icon={AlertTriangle} label="Risks"><Bullets items={idea.risks} /></Field>
      <Field icon={Rocket} label="Test it this week">{idea.firstTest}</Field>
    </div>
  );
}

function EnterpriseBody({ idea }: { idea: EnterpriseIdea }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field icon={Target} label="The problem">{idea.problemArea}</Field>
      <Field icon={Clock} label="How it's done today">{idea.traditionalToday}</Field>
      <div className="md:col-span-2"><Field icon={Sparkles} label="The innovative system">{idea.solution}</Field></div>
      <div className="md:col-span-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Layers className="size-3.5" /> Architecture</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {idea.architecture.map((c, i) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs">{c}</span>
              {i < idea.architecture.length - 1 ? <ArrowRight className="size-3 text-muted-foreground" /> : null}
            </span>
          ))}
        </div>
      </div>
      <Field icon={FileText} label="Data it needs"><Bullets items={idea.dataNeeded} /></Field>
      <Field icon={Plug} label="Integrates with">{idea.integrations.length ? <Bullets items={idea.integrations} /> : "—"}</Field>
      <Field icon={Sparkles} label="Role of AI">{idea.aiRole}</Field>
      <Field icon={Users} label="Buyer and users">{idea.buyer}</Field>
      <Field icon={Gauge} label="Value hypothesis">{idea.valueHypothesis}</Field>
      <Field icon={ShieldCheck} label="Compliance">{idea.compliance.length ? <Bullets items={idea.compliance} /> : "—"}</Field>
      <Field icon={Rocket} label="60–90 day pilot">{idea.pilot}</Field>
      <Field icon={Clock} label="Sales cycle">{idea.salesCycle}</Field>
      <Field icon={AlertTriangle} label="Risks"><Bullets items={idea.risks} /></Field>
      <Field icon={Wrench} label="How a startup gets in">{idea.startupAngle}</Field>
    </div>
  );
}
