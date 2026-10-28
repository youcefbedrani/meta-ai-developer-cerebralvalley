"use client";

import { AudioLines, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VOICE_UPLOAD_MAX_MB } from "@/lib/voice";

type Props = { experimentId: string; configured: boolean; costPer5Min: number; analysisCost: number };

/** Upload an interview recording: Meta Muse Voice Transcribe (who said what) → verified-quote analysis. */
export function RecordingUpload({ experimentId, configured, costPer5Min, analysisCost }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("experimentId", experimentId);
      form.append("file", file);
      const res = await fetch("/api/voice/interview", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; data?: { turns: number; analysis: { painPoints: unknown[] } } } | null;
      if (!body?.ok) {
        setError(body?.error ?? `Upload failed (HTTP ${res.status}).`);
        return;
      }
      toast.success(`Transcribed ${body.data?.turns ?? 0} turns · ${body.data?.analysis.painPoints.length ?? 0} verified pain quotes`);
      setFile(null);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AudioLines className="size-4 text-primary" /> Upload an interview recording
      </p>
      <p className="text-xs text-muted-foreground">
        MP3, M4A, WAV or WebM up to {VOICE_UPLOAD_MAX_MB} MB. Meta Muse Voice Transcribe writes down who said what; quotes are checked against the transcript and each one plays back
        from the moment it was said · {costPer5Min} credit per 5 minutes + {analysisCost} for the analysis.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={input}
          type="file"
          accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.webm,.ogg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy || !configured}
          className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <Button variant="gradient" className="h-9 px-4" disabled={!file || busy || !configured} onClick={upload}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Transcribing…" : "Transcribe & analyze"}
        </Button>
      </div>
      {busy ? <p className="mt-2 text-xs text-muted-foreground">Long recordings take a minute or two. Keep this tab open.</p> : null}
      {!configured ? <p className="mt-2 text-xs text-warning">Voice needs the Meta Model API (AI_BASE_URL=https://api.meta.ai/v1).</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
