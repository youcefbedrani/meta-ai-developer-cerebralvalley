"use client";

import { Eye, Loader2, ScanSearch, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PAGE_REVIEW_MAX_MB, type CompetitorPageReview, type OwnPageReview, type PageReviewMode } from "@/lib/validation/page-review";
import { cn } from "@/lib/utils";

export type ReviewItem = { id: string; mode: PageReviewMode; width: number; height: number; createdAt: string; result: OwnPageReview | CompetitorPageReview };

const SEVERITY = { high: "bg-destructive text-white", medium: "bg-warning text-white", low: "bg-muted-foreground text-white" } as const;

type Pin = { n: number; box: number[] | null; severity?: keyof typeof SEVERITY };

/** Upload a screenshot → Muse Spark vision review, with every issue pinned on the image. */
export function PageReviewPanel({ projectId, reviews, selected, cost, balance }: { projectId: string; reviews: ReviewItem[]; selected: ReviewItem | null; cost: number; balance: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<PageReviewMode>("own");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("projectId", projectId);
      form.append("mode", mode);
      form.append("file", file);
      const res = await fetch("/api/page-review", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; data?: { id: string } } | null;
      if (!body?.ok || !body.data) return setError(body?.error ?? `Review failed (HTTP ${res.status}).`);
      toast.success("Review ready");
      setFile(null);
      if (input.current) input.current.value = "";
      router.push(`/app/projects/${projectId}/review?r=${body.data.id}`);
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface ambient-glow p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <ScanSearch className="size-4" />
          </span>
          <div>
            <p className="font-medium">Page review</p>
            <p className="text-sm text-muted-foreground">
              Upload a screenshot. Meta Muse Spark looks at the page itself — layout, hierarchy, copy — judges it against your research and customer quotes, and pins every
              issue on the image · {cost} credits · {balance} left
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="What is this page?">
          {(
            [
              ["own", "My landing page", "Conversion critique + a rewrite in your customers' words"],
              ["competitor", "A competitor's page", "Plans and prices, weak spots, where you can win"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn("rounded-xl border px-3 py-2 text-left text-sm transition-colors", mode === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}
            >
              <span className="font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
            className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Button variant="gradient" className="h-10 px-5" onClick={submit} disabled={!file || busy || balance < cost}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Looking at the page…" : "Review it"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">PNG, JPG or WebP up to {PAGE_REVIEW_MAX_MB} MB. Full-page screenshots work; the top of very long pages is reviewed.</p>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      {reviews.length > 1 ? (
        <nav className="flex flex-wrap gap-2 text-xs" aria-label="Earlier reviews">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/app/projects/${projectId}/review?r=${r.id}`}
              className={cn("rounded-full border px-3 py-1", r.id === selected?.id ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            >
              {r.mode === "own" ? "My page" : (r.result as CompetitorPageReview).company || "Competitor"} · {new Date(r.createdAt).toLocaleDateString()}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? <ReviewView review={selected} /> : null}
    </div>
  );
}

function ReviewView({ review }: { review: ReviewItem }) {
  const [active, setActive] = useState<number | null>(null);
  const own = review.mode === "own" ? (review.result as OwnPageReview) : null;
  const comp = review.mode === "competitor" ? (review.result as CompetitorPageReview) : null;
  const pins: Pin[] = own ? own.issues.map((i, n) => ({ n: n + 1, box: i.box, severity: i.severity })) : comp!.weaknesses.map((w, n) => ({ n: n + 1, box: w.box }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="surface relative self-start overflow-hidden p-2">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked screenshot */}
          <img src={`/api/page-review/${review.id}/image`} alt="Reviewed page" className="w-full rounded-lg" style={{ aspectRatio: `${review.width} / ${review.height}` }} />
          {pins.map((p) =>
            p.box ? (
              <button
                key={p.n}
                type="button"
                onMouseEnter={() => setActive(p.n)}
                onMouseLeave={() => setActive(null)}
                onClick={() => document.getElementById(`issue-${review.id}-${p.n}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                aria-label={`Issue ${p.n}`}
                className={cn("absolute rounded-md border-2 transition-colors", active === p.n ? "border-primary bg-primary/15" : "border-primary/70 bg-primary/5")}
                style={{ left: `${p.box[0] / 10}%`, top: `${p.box[1] / 10}%`, width: `${Math.max(2, (p.box[2] - p.box[0]) / 10)}%`, height: `${Math.max(2, (p.box[3] - p.box[1]) / 10)}%` }}
              >
                <span className={cn("absolute -left-2.5 -top-2.5 grid size-5 place-items-center rounded-full text-[11px] font-bold shadow", p.severity ? SEVERITY[p.severity] : "bg-primary text-white")}>{p.n}</span>
              </button>
            ) : null,
          )}
        </div>
      </div>

      <div className="space-y-5">
        {own ? (
          <>
            <section className="surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="flex items-center gap-2 font-medium">
                  <Eye className="size-4 text-primary" /> 5-second test
                </h2>
                <span className="text-sm text-muted-foreground">
                  Score <b className="text-foreground">{own.score}</b>/100 · clarity {own.clarity}/10
                </span>
              </div>
              <p className="mt-2 text-sm">{own.fiveSecondTest}</p>
              {own.strengths.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {own.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </section>
            <IssueList
              reviewId={review.id}
              active={active}
              setActive={setActive}
              items={own.issues.map((i) => ({ title: i.title, detail: i.detail, extra: `Fix: ${i.fix}`, quote: i.customerQuote, severity: i.severity }))}
            />
            <section className="surface p-5">
              <h2 className="font-medium">Rewrite in your customers&apos; words</h2>
              <p className="mt-3 text-lg font-semibold tracking-tight">{own.rewrite.headline}</p>
              <p className="mt-1 text-sm text-muted-foreground">{own.rewrite.subheadline}</p>
              <span className="mt-3 inline-block rounded-lg bg-brand-gradient px-3 py-1.5 text-sm font-medium text-white">{own.rewrite.cta}</span>
            </section>
          </>
        ) : comp ? (
          <>
            <section className="surface p-5">
              <h2 className="font-medium">{comp.company ?? "Competitor"}</h2>
              <p className="mt-2 text-sm">{comp.positioning}</p>
              {comp.plans.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {comp.plans.map((p, i) => (
                    <div key={i} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-lg font-semibold">
                        {p.price}
                        {p.period ? <span className="text-xs font-normal text-muted-foreground"> / {p.period}</span> : null}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {p.highlights.map((h, j) => (
                          <li key={j}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No prices visible on this page.</p>
              )}
            </section>
            <IssueList reviewId={review.id} active={active} setActive={setActive} title="Weak spots" items={comp.weaknesses.map((w) => ({ title: w.title, detail: w.detail }))} />
            <section className="surface p-5">
              <h2 className="font-medium">Where you can win</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                {comp.opportunities.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function IssueList({
  reviewId,
  items,
  active,
  setActive,
  title = "Issues",
}: {
  reviewId: string;
  items: { title: string; detail: string; extra?: string; quote?: string | null; severity?: keyof typeof SEVERITY }[];
  active: number | null;
  setActive: (n: number | null) => void;
  title?: string;
}) {
  return (
    <section className="surface p-5">
      <h2 className="font-medium">{title}</h2>
      <ol className="mt-3 space-y-3">
        {items.map((it, i) => (
          <li
            key={i}
            id={`issue-${reviewId}-${i + 1}`}
            onMouseEnter={() => setActive(i + 1)}
            onMouseLeave={() => setActive(null)}
            className={cn("flex gap-3 rounded-lg p-2 text-sm transition-colors", active === i + 1 && "bg-primary/5")}
          >
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", it.severity ? SEVERITY[it.severity] : "bg-primary text-white")}>{i + 1}</span>
            <div>
              <p className="font-medium">{it.title}</p>
              <p className="text-muted-foreground">{it.detail}</p>
              {it.extra ? <p className="mt-1">{it.extra}</p> : null}
              {it.quote ? <p className="mt-1 text-xs italic text-muted-foreground">Customer: “{it.quote}”</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
