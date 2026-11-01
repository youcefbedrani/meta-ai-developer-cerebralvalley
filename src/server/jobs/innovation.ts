import "server-only";
import { eq } from "drizzle-orm";
import { enterpriseIdeasSchema, INNOVATION_LIMITS, observationSchema, processIdeasSchema, type Observation } from "@/lib/validation/innovation";
import {
  buildEnterpriseIdeasPrompt,
  buildObservePrompt,
  buildProcessIdeasPrompt,
  ENTERPRISE_IDEAS_SYSTEM,
  mockEnterpriseIdeas,
  mockObservation,
  mockProcessIdeas,
  OBSERVE_SYSTEM,
  PROCESS_IDEAS_SYSTEM,
  type ScanMaterial,
} from "@/server/ai/prompts/innovation";
import { callStructured } from "@/server/ai/run";
import { isVoiceConfigured, prepareAudio, transcribe } from "@/server/ai/voice";
import { refundCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { UserFacingError } from "@/server/data/errors";
import { unsafeToUserId } from "@/server/data/user-id";
import { normalizeImage, pdfText, sampleVideo } from "@/server/innovation/media";
import { innovationCreditRef, scanInputOf, scanMediaOf } from "@/server/services/innovation";
import { readUpload, saveUpload } from "@/server/storage";

/** Keeps `max` items spread evenly across the list (first and last kept). */
function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.round((i * (items.length - 1)) / Math.max(1, max - 1))]);
}

/**
 * One Traditional → Innovative scan: read the uploads (video frames + soundtrack, photos, PDF text),
 * ask Muse Spark what it sees (vision), then which software replaces it. Failures refund the credits.
 */
export async function runInnovationScan(scanId: string): Promise<void> {
  const db = getDb();
  const [scan] = await db.select().from(schema.innovationScans).where(eq(schema.innovationScans.id, scanId)).limit(1);
  if (!scan || (scan.status !== "queued" && scan.status !== "running")) return;
  const userId = unsafeToUserId(scan.userId);
  const usage = { userId, projectId: null, operation: scan.mode === "enterprise" ? "innovation_enterprise" : "innovation_scan" };
  const stage = (s: string) => db.update(schema.innovationScans).set({ stage: s }).where(eq(schema.innovationScans.id, scan.id));
  await db.update(schema.innovationScans).set({ status: "running", startedAt: new Date(), stage: "Reading your files", error: null }).where(eq(schema.innovationScans.id, scan.id));

  try {
    const input = scanInputOf(scan);
    const media = scanMediaOf(scan);
    const frames: { data: Buffer; label: string }[] = [];
    const photos: { data: Buffer; label: string }[] = [];
    const material: ScanMaterial = { images: [], pdfs: [], transcripts: [] };
    let photoNo = 0;

    for (const m of media) {
      const data = await readUpload(m.key);
      if (m.kind === "video") {
        await stage(`Watching ${m.name}`);
        const sampled = await sampleVideo(data);
        m.durationSec = Math.round(sampled.durationSec);
        m.frames = [];
        for (const f of sampled.frames) {
          m.frames.push({ key: await saveUpload("images", "jpg", f.data), atSec: f.atSec });
          frames.push({ data: f.data, label: `frame at ${Math.round(f.atSec)}s of video "${m.name}"` });
        }
        if (sampled.hasAudio && isVoiceConfigured()) {
          await stage(`Listening to ${m.name} (Muse Voice)`);
          try {
            const { segments } = await prepareAudio(data, { playback: false });
            const t = await transcribe(segments.slice(0, 2), { ...usage, mode: "PUSH_TO_TALK" });
            if (t.text.trim().length > 10) m.transcript = t.text.trim().slice(0, 8_000);
          } catch (err) {
            // A silent or noisy soundtrack shouldn't stop the scan: the frames still tell the story.
            console.warn(`[innovation] transcript skipped for ${scan.id}:`, err instanceof Error ? err.message : err);
          }
        }
        if (m.transcript) material.transcripts.push({ name: m.name, text: m.transcript });
      } else if (m.kind === "image") {
        photos.push({ data: await normalizeImage(data), label: `photo ${++photoNo} "${m.name}"` });
      } else {
        await stage(`Reading ${m.name}`);
        const text = await pdfText(data);
        m.pdfChars = text.length;
        if (text) material.pdfs.push({ name: m.name, text });
      }
    }
    await db.update(schema.innovationScans).set({ media: media as unknown as Record<string, unknown>[] }).where(eq(schema.innovationScans.id, scan.id));

    // Photos are chosen on purpose, so they keep their place; video frames fill the rest, spread over time.
    const keptPhotos = photos.slice(0, INNOVATION_LIMITS.maxImages);
    const images = [...keptPhotos, ...spread(frames, INNOVATION_LIMITS.maxImages - keptPhotos.length)];
    material.images = images.map((i) => ({ label: i.label }));
    const hasMaterial = images.length > 0 || material.pdfs.length > 0 || material.transcripts.length > 0;
    if (scan.mode === "process" && !hasMaterial && input.notes.length < 40) throw new UserFacingError("There was nothing to analyse in those files. Add a description and try again.");

    let observation: Observation | null = null;
    if (scan.mode === "process" || hasMaterial) {
      await stage("Muse Spark is mapping how the work is done today");
      observation = await callStructured({
        ...usage,
        tier: "smart",
        schema: observationSchema,
        system: OBSERVE_SYSTEM,
        prompt: buildObservePrompt(input, material),
        images: images.map((i) => ({ data: i.data, mediaType: "image/jpeg" })),
        mock: mockObservation,
        maxOutputTokens: 6_000,
      });
      await db.update(schema.innovationScans).set({ observation: observation as unknown as Record<string, unknown> }).where(eq(schema.innovationScans.id, scan.id));
    }

    await stage(scan.mode === "enterprise" ? "Muse Spark is designing enterprise systems" : "Muse Spark is proposing software ideas");
    const ideas =
      scan.mode === "enterprise"
        ? (
            await callStructured({
              ...usage,
              tier: "smart",
              schema: enterpriseIdeasSchema,
              system: ENTERPRISE_IDEAS_SYSTEM,
              prompt: buildEnterpriseIdeasPrompt(input, material, observation),
              mock: mockEnterpriseIdeas,
              maxOutputTokens: 14_000,
            })
          ).ideas
        : (
            await callStructured({
              ...usage,
              tier: "smart",
              schema: processIdeasSchema,
              system: PROCESS_IDEAS_SYSTEM,
              prompt: buildProcessIdeasPrompt(input, observation!),
              mock: mockProcessIdeas,
              maxOutputTokens: 12_000,
            })
          ).ideas;

    await db
      .update(schema.innovationScans)
      .set({ status: "succeeded", stage: null, ideas: ideas as unknown as Record<string, unknown>[], finishedAt: new Date() })
      .where(eq(schema.innovationScans.id, scan.id));
  } catch (err) {
    console.error(`[innovation] scan ${scan.id} failed:`, err instanceof Error ? err.message : err);
    const reason = err instanceof UserFacingError ? `${err.message} ` : "";
    await db
      .update(schema.innovationScans)
      .set({ status: "failed", stage: null, error: `${reason}The scan couldn't finish. Your credits were refunded.`.trim(), finishedAt: new Date() })
      .where(eq(schema.innovationScans.id, scan.id));
    await refundCredits(userId, innovationCreditRef(scan.id), "innovation scan failed").catch(() => 0);
  }
}
