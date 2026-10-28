"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/voice";
import { cn } from "@/lib/utils";

/** Long enough for a real pitch, short enough to stay one transcription request. */
const MAX_SECONDS = 180;

type State = { kind: "idle" } | { kind: "recording" } | { kind: "sending" } | { kind: "done"; name: string; transcript: string };

/** Record a spoken idea in the browser → Meta Muse Voice Transcribe → Muse Spark turns it into a project → Autopilot. */
export function VoicePitch({ cost }: { cost: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);

  useEffect(() => {
    if (state.kind !== "recording") return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (s >= MAX_SECONDS) recorder.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  // Release the microphone if the user leaves mid-recording.
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function begin() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void send(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
      };
      recorder.current = r;
      r.onstart = () => {
        startedAt.current = Date.now();
        setElapsed(0);
        setState({ kind: "recording" });
      };
      r.start(1000);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser's site settings, or type the idea below.");
    }
  }

  async function send(blob: Blob) {
    setState({ kind: "sending" });
    try {
      const form = new FormData();
      form.append("file", blob, `pitch.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
      const res = await fetch("/api/voice/pitch", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; data?: { projectId: string; name: string; transcript: string; autopilotGoal: string | null } } | null;
      if (!body?.ok || !body.data) {
        setError(body?.error ?? `Something went wrong (HTTP ${res.status}).`);
        setState({ kind: "idle" });
        return;
      }
      const { projectId, name, transcript, autopilotGoal } = body.data;
      setState({ kind: "done", name, transcript });
      toast.success(`Project “${name}” created`);
      router.push(`/app/projects/${projectId}/autopilot${autopilotGoal ? `?goal=${encodeURIComponent(autopilotGoal)}` : ""}`);
    } catch {
      setError("Upload failed. Check your connection and try again.");
      setState({ kind: "idle" });
    }
  }

  const recording = state.kind === "recording";
  return (
    <div className="surface ambient-glow p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-glow", recording ? "animate-pulse bg-destructive" : "bg-brand-gradient")}>
            <Mic className="size-4" />
          </span>
          <div>
            <p className="font-medium">Pitch it out loud</p>
            <p className="text-sm text-muted-foreground">
              Talk for up to {MAX_SECONDS / 60} minutes: who has the problem, what they do today, what you&apos;d build. Meta Muse Voice Transcribe and Muse Spark turn it into a project,
              then the Autopilot validates it · {cost} credits
            </p>
          </div>
        </div>
        {recording ? (
          <Button variant="destructive" className="h-10 px-5" onClick={() => recorder.current?.stop()}>
            <Square /> Stop · {formatClock(elapsed * 1000)}
          </Button>
        ) : (
          <Button variant="gradient" className="h-10 px-5" onClick={begin} disabled={state.kind === "sending" || state.kind === "done"}>
            {state.kind === "sending" || state.kind === "done" ? <Loader2 className="animate-spin" /> : <Mic />}
            {state.kind === "sending" ? "Understanding your idea…" : state.kind === "done" ? "Opening Autopilot…" : "Record"}
          </Button>
        )}
      </div>
      {state.kind === "done" ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{state.name}:</span> “{state.transcript.slice(0, 280)}
          {state.transcript.length > 280 ? "…" : ""}”
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
