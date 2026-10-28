"use client";

import { FileText, Loader2, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeNotesAction, generateScriptAction } from "@/app/(app)/app/(founder)/lab/actions";
import { ConfigErrorNotice } from "@/components/config-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NotesAnalysis } from "@/lib/validation/experiments";
import { formatClock, turnForQuote, type VoiceTurn } from "@/lib/voice";
import { RecordingUpload } from "@/components/voice/recording-upload";
import { cn } from "@/lib/utils";

const VERDICT = {
  supports: "text-emerald-700 bg-emerald-50",
  contradicts: "text-rose-700 bg-rose-50",
  inconclusive: "text-amber-700 bg-amber-50",
} as const;

export type AnalysisRecording = { id: string; hasAudio: boolean; durationMs: number; turns: VoiceTurn[] };

export function AnalysisView({ analysis, recording }: { analysis: NotesAnalysis; recording?: AnalysisRecording | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const playAt = (ms: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, ms / 1000 - 0.5);
    void a.play();
  };
  const Said = ({ quote }: { quote: string }) => {
    const turn = recording ? turnForQuote(quote, recording.turns) : null;
    if (!turn) return null;
    return recording?.hasAudio ? (
      <button type="button" onClick={() => playAt(turn.startMs)} className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 align-middle text-[11px] font-medium text-primary hover:bg-primary/20" aria-label={`Play from ${formatClock(turn.startMs)}`}>
        <Play className="size-2.5" /> {formatClock(turn.startMs)}
      </button>
    ) : (
      <span className="ml-1.5 text-[11px] text-muted-foreground">{formatClock(turn.startMs)}</span>
    );
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase", VERDICT[analysis.hypothesisVerdict])}>AI verdict: {analysis.hypothesisVerdict}</span>
        <span className="text-xs text-muted-foreground">Advisory only — you decide whether the experiment passed.</span>
      </div>
      {recording?.hasAudio ? <audio ref={audio} controls preload="metadata" src={`/api/voice/audio/${recording.id}`} className="h-9 w-full" /> : null}
      <p>{analysis.summary}</p>
      <p className="text-muted-foreground">{analysis.verdictReasoning}</p>
      {analysis.painPoints.length ? (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Pain points (quoted)</p>
          <ul className="space-y-1.5">
            {analysis.painPoints.map((p, i) => (
              <li key={i}>{p.point} <span className="text-muted-foreground">— “{p.quote}”</span><Said quote={p.quote} /></li>
            ))}
          </ul>
        </div>
      ) : null}
      {analysis.willingnessToPay.length ? (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Willingness-to-pay signals</p>
          <ul className="space-y-1.5">{analysis.willingnessToPay.map((w, i) => <li key={i}>{w.signal} <span className="text-muted-foreground">— “{w.quote}”</span><Said quote={w.quote} /></li>)}</ul>
        </div>
      ) : null}
      {analysis.followUps.length ? (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Follow-ups</p>
          <ul className="list-disc space-y-1 pl-5">{analysis.followUps.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      ) : null}
      {recording?.turns.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Transcript ({formatClock(recording.durationMs)})</summary>
          <ol className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-2">
            {recording.turns.map((t, i) => (
              <li key={i} className="flex gap-2">
                {recording.hasAudio ? (
                  <button type="button" onClick={() => playAt(t.startMs)} className="shrink-0 font-mono text-primary hover:underline">{formatClock(t.startMs)}</button>
                ) : (
                  <span className="shrink-0 font-mono">{formatClock(t.startMs)}</span>
                )}
                <span>{t.speaker ? <b className="text-foreground">{t.speaker}: </b> : null}{t.text}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export function InterviewTools({ experimentId, hasScript, aiConfigured, aiMissing, voiceConfigured, costs }: { experimentId: string; hasScript: boolean; aiConfigured: boolean; aiMissing: string[]; voiceConfigured: boolean; costs: { script: number; analysis: number; voicePer5Min: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"script" | "notes" | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="surface p-6">
      <h2 className="font-medium">Interview tools</h2>
      {!aiConfigured ? <div className="mt-3"><ConfigErrorNotice title="AI provider is not configured" missing={aiMissing} /></div> : null}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Interview script</p>
          <p className="text-xs text-muted-foreground">Mom-Test style questions based on your hypothesis and research · {costs.script} credits. Saved into the procedure.</p>
        </div>
        <Button
          variant="outline"
          className="rounded-[10px]"
          disabled={pending || !aiConfigured}
          onClick={() => {
            setBusy("script");
            setError(null);
            start(async () => {
              const r = await generateScriptAction(experimentId);
              setBusy(null);
              if (!r.ok) return setError(r.error);
              toast.success("Script saved to the procedure");
              router.refresh();
            });
          }}
        >
          {busy === "script" ? <Loader2 className="animate-spin" /> : <FileText />} {hasScript ? "Regenerate script" : "Generate script"}
        </Button>
      </div>
      <RecordingUpload experimentId={experimentId} configured={voiceConfigured && aiConfigured} costPer5Min={costs.voicePer5Min} analysisCost={costs.analysis} />
      <div className="mt-4 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Analyze interview notes</p>
        <p className="text-xs text-muted-foreground">Paste notes from one interview · {costs.analysis} credits. Quotes are checked against your notes; the analysis is saved as a result.</p>
        <Textarea className="mt-3" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste your raw notes or transcript…" />
        <div className="mt-3 flex justify-end">
          <Button
            variant="gradient"
            className="h-9 px-4"
            disabled={pending || !aiConfigured || notes.trim().length < 40}
            onClick={() => {
              setBusy("notes");
              setError(null);
              start(async () => {
                const r = await analyzeNotesAction(experimentId, notes);
                setBusy(null);
                if (!r.ok) return setError(r.fieldErrors?.notes?.[0] ?? r.error);
                setNotes("");
                toast.success("Analysis saved as a result");
                router.refresh();
              });
            }}
          >
            {busy === "notes" ? <Loader2 className="animate-spin" /> : <Sparkles />} Analyze notes
          </Button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
