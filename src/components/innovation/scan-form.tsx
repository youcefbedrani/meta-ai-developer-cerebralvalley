"use client";

import { Building2, CheckCircle2, CircleAlert, FileText, Film, ImageIcon, Loader2, Sparkles, Upload, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MetaMark } from "@/components/brand/hackathon-lockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mediaKindOf, type InnovationMode, type MediaKind } from "@/lib/validation/innovation";

type Limits = { files: number; videoMb: number; imageMb: number; pdfMb: number; videoMinutes: number };
type Status = "queued" | "running" | "succeeded" | "failed" | "cancelled";

const KIND_ICON: Record<MediaKind, typeof Film> = { video: Film, image: ImageIcon, pdf: FileText };
// A fixed locale and time zone, so the server and the browser render the same text.
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

const PROCESS_EXAMPLES = [
  "A clinic receptionist books appointments in a paper diary and calls patients to remind them.",
  "Our warehouse team counts stock by hand every Friday and types it into Excel.",
  "A restaurant takes delivery orders by phone and writes them on paper tickets for the kitchen.",
];
const ENTERPRISE_EXAMPLES: Record<string, string> = {
  "Oil & gas": "Field inspections of pipelines and wellheads are done with paper checklists; findings reach engineers days later.",
  Banking: "SME loan applications take weeks: documents arrive by email, analysts re-type them and check them manually.",
  "Healthcare & hospitals": "Bed management is done by phone and whiteboards; patients wait hours in emergency for a bed.",
  "Logistics & shipping": "Customs paperwork for containers is prepared by hand from emails and PDFs, causing delays at the port.",
};

/** Upload with progress (fetch can't report upload progress): resolves with the JSON body. */
function upload(form: FormData, onProgress: (pct: number) => void): Promise<{ ok: boolean; data?: { scanId: string }; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/innovation/scan");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, error: xhr.status === 413 ? "Those files are too large." : "Something went wrong. Please try again." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "The upload failed. Check your connection and try again." });
    xhr.send(form);
  });
}

export function ScanForm({ mode: initialMode, balance, costs, industries, sizes, limits }: { mode: InnovationMode; balance: number; costs: Record<InnovationMode, number>; industries: string[]; sizes: string[]; limits: Limits }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InnovationMode>(initialMode);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [region, setRegion] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const cost = costs[mode];

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const kind = mediaKindOf(f.name, f.type);
      const max = kind === "video" ? limits.videoMb : kind === "pdf" ? limits.pdfMb : limits.imageMb;
      if (!kind) toast.error(`"${f.name}" isn't a video, image or PDF.`);
      else if (f.size > max * 1024 * 1024) toast.error(`"${f.name}" is over ${max} MB.`);
      else if (next.length >= limits.files) toast.error(`Up to ${limits.files} files.`);
      else next.push(f);
    }
    setFiles(next);
  }

  async function submit() {
    if (mode === "process" && !files.length && notes.trim().length < 40) return void toast.error("Upload a video, photos or a PDF, or describe the work in a few sentences.");
    if (mode === "enterprise" && !industry) return void toast.error("Pick an industry.");
    const form = new FormData();
    form.set("mode", mode);
    form.set("title", title);
    form.set("notes", notes);
    if (mode === "enterprise") {
      form.set("industry", industry);
      form.set("companySize", size);
      form.set("region", region);
    }
    for (const f of files) form.append("files", f);
    setProgress(0);
    const r = await upload(form, setProgress);
    if (!r.ok || !r.data) {
      setProgress(null);
      return void toast.error(r.error ?? "Something went wrong.");
    }
    toast.success("Muse Spark is on it");
    router.push(`/app/innovation/${r.data.scanId}`);
  }

  const busy = progress !== null;
  return (
    <section className="surface ambient-glow p-5 sm:p-6">
      <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Scan type">
        {(
          [
            { m: "process", icon: Wrench, label: "Manual work → software", hint: "A video, photos or documents of how a business or team works today. Get SaaS, automation and app ideas." },
            { m: "enterprise", icon: Building2, label: "Big companies & hard problems", hint: "Oil & gas, banks, hospitals, logistics… Complex system ideas with architecture, compliance and a pilot plan." },
          ] as const
        ).map((t) => (
          <button key={t.m} type="button" role="tab" aria-selected={mode === t.m} onClick={() => setMode(t.m)} className={cn("flex gap-3 rounded-xl border p-3 text-left transition-colors", mode === t.m ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/40")}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", mode === t.m ? "bg-brand-gradient text-white" : "bg-muted text-muted-foreground")}><t.icon className="size-4" /></span>
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === "enterprise" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-muted-foreground">Industry</span>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm">
              <option value="">Choose…</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Company size (optional)</span>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm">
              <option value="">Any</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Region (optional)</span>
            <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={80} placeholder="e.g. Gulf region, North Africa, EU" className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
          </label>
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn("mt-4 rounded-xl border-2 border-dashed p-5 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "border-border")}
      >
        <Upload className="mx-auto size-6 text-primary" />
        <p className="mt-2 text-sm font-medium">{mode === "process" ? "Drop a video of the work being done, photos or a PDF" : "Optional: drop process documents, reports, photos or a video"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Video up to {limits.videoMb} MB (first {limits.videoMinutes} minutes are used; narration is transcribed), images up to {limits.imageMb} MB, PDFs up to {limits.pdfMb} MB · up to {limits.files} files
        </p>
        <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => input.current?.click()} disabled={busy}>Choose files</Button>
        <input ref={input} type="file" multiple hidden accept="video/*,image/*,application/pdf,.pdf,.mov,.mp4,.webm" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        {files.length ? (
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {files.map((f, i) => {
              const Icon = KIND_ICON[mediaKindOf(f.name, f.type) ?? "image"];
              return (
                <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-xs">
                  <Icon className="size-3.5 text-primary" />
                  <span className="max-w-48 truncate">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-muted"><X className="size-3.5" /></button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <label className="mt-4 block text-sm">
        <span className="text-muted-foreground">{mode === "process" ? "Describe the work and what hurts (helps a lot)" : "The challenge, in your words (optional but recommended)"}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} placeholder={mode === "process" ? "Who does it, how often, what goes wrong…" : "What is slow, risky or expensive today? Which team? Any constraints?"} className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-sm" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(mode === "process" ? PROCESS_EXAMPLES : Object.entries(ENTERPRISE_EXAMPLES).map(([ind, text]) => `${ind}|${text}`)).map((ex) => {
          const [ind, text] = mode === "enterprise" ? ex.split("|") : [null, ex];
          return (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setNotes(text);
                if (ind) setIndustry(ind);
              }}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              {ind ? `${ind}: ` : "Example: "}
              {text.length > 60 ? `${text.slice(0, 60)}…` : text}
            </button>
          );
        })}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Name this scan (optional)" className="mt-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MetaMark /> Muse Spark watches the frames and reads the documents{mode === "process" ? ", Muse Voice transcribes the narration" : ""}. Takes 1–2 minutes. Credits are refunded if it fails.
        </p>
        <Button variant="gradient" className="h-10 shrink-0 px-5" disabled={busy || balance < cost} onClick={submit}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {busy ? (progress! < 100 ? `Uploading ${progress}%` : "Starting…") : `Find ideas · ${cost} credits`}
        </Button>
      </div>
      {busy && progress! < 100 ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${progress}%` }} /></div>
      ) : null}
      {balance < cost ? <p className="mt-2 text-xs text-destructive">You need {cost} credits. <Link href="/app/settings#billing" className="underline">Get more</Link></p> : null}
    </section>
  );
}

export function ScanList({ scans }: { scans: { id: string; mode: InnovationMode; title: string; status: Status; stage: string | null; ideas: number; createdAt: string }[] }) {
  if (!scans.length) return null;
  return (
    <section>
      <h2 className="font-medium">Your scans</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {scans.map((s) => (
          <li key={s.id}>
            <Link href={`/app/innovation/${s.id}`} className="surface flex items-start gap-3 p-4 transition hover:-translate-y-0.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{s.mode === "enterprise" ? <Building2 className="size-4" /> : <Wrench className="size-4" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.title || "Untitled scan"}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.status === "succeeded" ? (
                    <><CheckCircle2 className="size-3.5 text-emerald-600" /> {s.ideas} ideas</>
                  ) : s.status === "failed" || s.status === "cancelled" ? (
                    <><CircleAlert className="size-3.5 text-destructive" /> Failed</>
                  ) : (
                    <><Loader2 className="size-3.5 animate-spin" /> {s.stage ?? "Queued"}</>
                  )}
                  <span>· {s.mode === "enterprise" ? "Enterprise" : "Manual work"} · {dateFmt.format(new Date(s.createdAt))}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
