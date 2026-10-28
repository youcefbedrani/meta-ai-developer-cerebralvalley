import "server-only";
import { CREDIT_COSTS } from "@/lib/plans";
import { interviewScriptSchema, landingContentSchema, notesAnalysisSchema, notesInputSchema, type NotesAnalysis } from "@/lib/validation/experiments";
import {
  buildLandingPrompt,
  buildNotesPrompt,
  buildScriptPrompt,
  LANDING_SYSTEM,
  mockLanding,
  mockNotesAnalysis,
  mockScript,
  NOTES_SYSTEM,
  SCRIPT_SYSTEM,
  scriptToMarkdown,
} from "@/server/ai/prompts/validation";
import { runWithCredits } from "@/server/ai/run";
import { addResult, getExperiment, setExperimentProcedure } from "@/server/data/experiments";
import { NotFoundError } from "@/server/data/errors";
import type { UserId } from "@/server/data/user-id";
import { quoteAppearsIn } from "@/server/jobs/research/verify";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectContext } from "./project-context";

export async function generateInterviewScript(userId: UserId, experimentId: string): Promise<string> {
  const e = await getExperiment(userId, experimentId);
  if (!e) throw new NotFoundError("Experiment");
  await enforceAiLimits(userId);
  const { context } = await getProjectContext(userId, e.projectId);
  const script = await runWithCredits({
    userId,
    projectId: e.projectId,
    operation: "interview_script",
    tier: "fast",
    credits: CREDIT_COSTS.interview_script,
    schema: interviewScriptSchema,
    system: SCRIPT_SYSTEM,
    prompt: buildScriptPrompt(context, { title: e.title, hypothesis: e.hypothesis, audience: e.audience ?? "", successCriteria: e.successCriteria }),
    mock: mockScript,
  });
  const markdown = scriptToMarkdown(script);
  await setExperimentProcedure(userId, e.id, markdown);
  return markdown;
}

/** Analyses pasted interview notes. Quotes not found verbatim in the notes are discarded. */
export async function analyzeInterviewNotes(userId: UserId, experimentId: string, rawNotes: string): Promise<NotesAnalysis> {
  const e = await getExperiment(userId, experimentId);
  if (!e) throw new NotFoundError("Experiment");
  const { notes } = notesInputSchema.parse({ notes: rawNotes });
  return analyzeAndSave(userId, e, notes, { metric: "Interview notes", notes }, {});
}

/** Transcripts run longer than pasted notes; past this the analysis reads the first part only. */
const TRANSCRIPT_MAX_CHARS = 60_000;

/**
 * Analyses a transcribed interview recording (speaker-labelled lines). Same verbatim-quote check as notes;
 * the transcript itself lives on the recording, so the result links to it instead of copying it.
 */
export async function analyzeInterviewTranscript(userId: UserId, experimentId: string, transcript: string, recording: { id: string; durationMs: number }): Promise<NotesAnalysis> {
  const e = await getExperiment(userId, experimentId);
  if (!e) throw new NotFoundError("Experiment");
  const notes = transcript.slice(0, TRANSCRIPT_MAX_CHARS);
  const minutes = Math.max(1, Math.round(recording.durationMs / 60_000));
  return analyzeAndSave(userId, e, notes, { metric: "Interview recording", notes: `Transcribed recording (${minutes} min) with Meta Muse Voice Transcribe.` }, { recordingId: recording.id }, true);
}

async function analyzeAndSave(
  userId: UserId,
  e: NonNullable<Awaited<ReturnType<typeof getExperiment>>>,
  notes: string,
  result: { metric: string; notes: string },
  extra: Record<string, unknown>,
  transcript = false,
): Promise<NotesAnalysis> {
  await enforceAiLimits(userId);
  const raw = await runWithCredits({
    userId,
    projectId: e.projectId,
    operation: "interview_analysis",
    tier: "fast",
    credits: CREDIT_COSTS.interview_analysis,
    schema: notesAnalysisSchema,
    system: NOTES_SYSTEM,
    prompt: buildNotesPrompt({ hypothesis: e.hypothesis, successCriteria: e.successCriteria }, notes, transcript),
    mock: () => mockNotesAnalysis(notes),
  });
  const analysis: NotesAnalysis = {
    ...raw,
    painPoints: raw.painPoints.filter((p) => quoteAppearsIn(p.quote, notes)),
    willingnessToPay: raw.willingnessToPay.filter((w) => quoteAppearsIn(w.quote, notes)),
  };
  await addResult(userId, e.id, result, { kind: "interview_analysis", analysis, ...extra });
  return analysis;
}

export async function generateLandingCopy(userId: UserId, projectId: string) {
  await enforceAiLimits(userId);
  const { context, project } = await getProjectContext(userId, projectId);
  return runWithCredits({
    userId,
    projectId: project.id,
    operation: "landing_copy",
    tier: "fast",
    credits: CREDIT_COSTS.landing_copy,
    schema: landingContentSchema,
    system: LANDING_SYSTEM,
    prompt: buildLandingPrompt(context),
    mock: () => mockLanding(context),
  });
}
