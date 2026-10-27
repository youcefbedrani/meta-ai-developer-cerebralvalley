import { ExternalLink, FlaskConical, ListChecks, ShieldCheck } from "lucide-react";
import { RATING_KEYS, REPORT_SECTIONS, type Statement } from "@/lib/validation/research";
import type { LoadedReport, SourceRow } from "@/server/data/research";
import { KindBadge } from "./kind-badge";

const RATING_LABELS: Record<(typeof RATING_KEYS)[number], { title: string; hint: string }> = {
  demandEvidence: { title: "Demand evidence", hint: "How strong the evidence of demand is" },
  competitivePressure: { title: "Competitive pressure", hint: "Higher means more pressure" },
  feasibility: { title: "Feasibility", hint: "Higher means easier for you to build" },
  monetization: { title: "Monetization", hint: "How clear willingness to pay is" },
};

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

function SourceChip({ k, source }: { k: string; source?: SourceRow }) {
  if (!source) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={`${source.title ?? source.url} — retrieved ${fmt.format(source.retrievedAt)}`}
      className="inline-flex items-center rounded border border-border px-1 font-mono text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
    >
      {k}
    </a>
  );
}

function StatementList({ items, sources }: { items: Statement[]; sources: LoadedReport["sources"] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing found for this section.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((st, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
          <KindBadge kind={st.kind} />
          <span>
            {st.text}{" "}
            <span className="inline-flex flex-wrap gap-1 align-middle">
              {st.sources.map((k) => <SourceChip key={k} k={k} source={sources.get(k)} />)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReportView({ data }: { data: LoadedReport }) {
  const { report, sources, meta } = data;
  const v = meta.verification;
  const removed = (v.downgraded ?? 0) + (v.droppedEvidence ?? 0) + (v.droppedCompetitors ?? 0);

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Validation report</h2>
          <span className="text-xs text-muted-foreground">Generated {fmt.format(data.createdAt)} · {sources.size} sources</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{report.summary}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><KindBadge kind="FACT" /> backed by a stored source</span>
          <span className="flex items-center gap-1.5"><KindBadge kind="ANALYSIS" /> AI interpretation</span>
          <span className="flex items-center gap-1.5"><KindBadge kind="ASSUMPTION" /> needs testing</span>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
          {removed
            ? `Citation check: ${v.downgraded ?? 0} unsupported fact(s) were relabelled as assumptions, ${v.droppedEvidence ?? 0} quote(s) not found in their source were discarded, and ${v.droppedCompetitors ?? 0} unsourced competitor(s) were removed.`
            : "Citation check passed: every fact cites a stored source and every extracted quote was found in its source."}
          {" "}A report is not validation — only experiment results are.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RATING_KEYS.map((k) => {
          const r = report.ratings[k];
          return (
            <div key={k} className="surface p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{RATING_LABELS[k].title}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{r.score}</span>
                <span className="text-sm text-muted-foreground">/ 5 · {r.label}</span>
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= r.score ? "h-1.5 flex-1 rounded-full bg-brand-gradient" : "h-1.5 flex-1 rounded-full bg-muted"} />)}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{r.justification}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {REPORT_SECTIONS.map((s) => (
          <section key={s.key} className="surface p-5">
            <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{s.title}</h3>
            <StatementList items={report.sections[s.key]} sources={sources} />
          </section>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><FlaskConical className="size-3.5" /> Recommended experiments</h3>
          <ul className="space-y-3 text-sm">
            {report.recommendedExperiments.map((e, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <p className="font-medium">{e.title} <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-xs font-normal capitalize text-muted-foreground">{e.type.replace("_", " ")}</span></p>
                <p className="mt-1 text-muted-foreground">{e.hypothesis}</p>
                <p className="mt-1 text-xs"><span className="text-muted-foreground">Success:</span> {e.successCriteria}</p>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-4">
          <section className="surface p-5">
            <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Open questions</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">{report.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </section>
          <section className="surface p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><ListChecks className="size-3.5" /> MVP scope (draft)</h3>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="mb-1 font-medium">Must-have</p><ul className="list-disc space-y-1 pl-5">{report.mvpScope.mustHave.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div><p className="mb-1 font-medium">Later</p><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{report.mvpScope.later.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            </div>
          </section>
          <section className="surface p-5">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Next action</h3>
            <p className="mt-2 text-sm">{report.nextAction}</p>
          </section>
        </div>
      </div>

      <section className="surface p-5" id="sources">
        <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Sources</h3>
        <ol className="space-y-2 text-sm">
          {[...sources.entries()].map(([k, s]) => (
            <li key={k} className="flex items-start gap-3">
              <span className="mt-0.5 w-7 shrink-0 font-mono text-xs text-muted-foreground">{k}</span>
              <div className="min-w-0">
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all hover:underline">
                  {s.title ?? s.url} <ExternalLink className="size-3 shrink-0" />
                </a>
                <p className="text-xs text-muted-foreground">{s.domain} · retrieved {fmt.format(s.retrievedAt)}{s.publishedAt ? ` · published ${fmt.format(s.publishedAt)}` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Search queries used</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{meta.queries.map((q) => <li key={q}>{q}</li>)}</ul>
        </details>
      </section>
    </div>
  );
}
