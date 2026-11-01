import "server-only";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { ConfigError, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { createProjectSchema } from "@/lib/validation/project";
import {
  INNOVATION_LIMITS,
  isEnterpriseIdea,
  mediaKindOf,
  scanInputSchema,
  type InnovationIdea,
  type MediaKind,
  type Observation,
  type ScanInput,
  type ScanMedia,
} from "@/lib/validation/innovation";
import { refundCredits, reserveCredits } from "@/server/billing/credits";
import { getDb, schema } from "@/server/db/client";
import { NotFoundError, UserFacingError } from "@/server/data/errors";
import { createProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { enqueueInnovation } from "@/server/jobs/queue";
import { enforceAiLimits } from "@/server/rate-limit";
import { deleteUpload, saveUpload } from "@/server/storage";

/*
 * Traditional → Innovative scans: the client uploads how work is done today; a background job
 * (innovation queue) samples video frames, transcribes the soundtrack, reads PDFs, and asks Muse Spark
 * first what it sees, then which software would replace it.
 */

export type InnovationScan = typeof schema.innovationScans.$inferSelect;
export const innovationCreditRef = (scanId: string) => `innovation:${scanId}`;
const operationFor = (mode: ScanInput["mode"]) => (mode === "enterprise" ? "innovation_enterprise" : "innovation_scan");
export const scanCost = (mode: ScanInput["mode"]) => CREDIT_COSTS[operationFor(mode)];

/** A scan that hasn't finished after this long is treated as crashed: failed and refunded. */
const STALE_MS = 20 * 60_000;

const EXT: Record<MediaKind, (name: string) => string> = {
  video: (n) => (/\.(mov|webm|m4v|avi|mkv)$/i.exec(n)?.[1] ?? "mp4").toLowerCase(),
  image: (n) => (/\.(png|webp|heic|jpe?g)$/i.exec(n)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg"),
  pdf: () => "pdf",
};
const MAX_MB: Record<MediaKind, number> = { video: INNOVATION_LIMITS.videoMb, image: INNOVATION_LIMITS.imageMb, pdf: INNOVATION_LIMITS.pdfMb };
const FOLDER: Record<MediaKind, "videos" | "images" | "docs"> = { video: "videos", image: "images", pdf: "docs" };

/** Checks every file before anything is stored, so a bad file never leaves half an upload behind. */
export function checkFiles(files: File[]): { file: File; kind: MediaKind }[] {
  if (files.length > INNOVATION_LIMITS.files) throw new UserFacingError(`Upload at most ${INNOVATION_LIMITS.files} files.`);
  return files.map((file) => {
    const kind = mediaKindOf(file.name, file.type);
    if (!kind) throw new UserFacingError(`"${file.name}" isn't a video, image or PDF.`);
    if (file.size > MAX_MB[kind] * 1024 * 1024) throw new UserFacingError(`"${file.name}" is too large (${kind === "video" ? "videos" : kind === "pdf" ? "PDFs" : "images"} up to ${MAX_MB[kind]} MB).`);
    return { file, kind };
  });
}

/** Stores the uploads, creates the scan, reserves the credits and queues the job. */
export async function startInnovationScan(userId: UserId, raw: Record<string, unknown>, files: File[]): Promise<{ scanId: string }> {
  const input = scanInputSchema.parse(raw);
  const checked = checkFiles(files);
  if (input.mode === "process" && !checked.length && input.notes.length < 40) throw new UserFacingError("Upload a video, photos or a PDF, or describe the work in a few sentences.");
  if (input.mode === "enterprise" && !checked.length && input.notes.length < 20 && !input.industry) throw new UserFacingError("Pick an industry or describe the challenge.");
  const ai = getIntegrationStatus("ai");
  if (!ai.configured) throw new ConfigError("ai", ai.missing);
  const redis = getIntegrationStatus("redis");
  if (!redis.configured) throw new ConfigError("redis", redis.missing);
  await enforceAiLimits(userId);

  const db = getDb();
  const running = await db
    .select({ id: schema.innovationScans.id })
    .from(schema.innovationScans)
    .where(and(eq(schema.innovationScans.userId, userId), inArray(schema.innovationScans.status, ["queued", "running"])))
    .limit(2);
  if (running.length >= 2) throw new UserFacingError("Two scans are already running. Wait for one to finish.");

  const media: ScanMedia[] = [];
  try {
    for (const { file, kind } of checked) {
      const key = await saveUpload(FOLDER[kind], EXT[kind](file.name), Buffer.from(await file.arrayBuffer()));
      media.push({ key, kind, name: file.name.slice(0, 120) || kind });
    }
  } catch (err) {
    await Promise.all(media.map((m) => deleteUpload(m.key).catch(() => {})));
    throw err;
  }

  const cost = scanCost(input.mode);
  const title = input.title || (input.mode === "enterprise" ? `${input.industry ?? "Enterprise"} challenges` : media[0]?.name.replace(/\.[^.]+$/, "") || input.notes.slice(0, 60));
  const [scan] = await db
    .insert(schema.innovationScans)
    .values({ userId, mode: input.mode, title: title.slice(0, 120), input: input as unknown as Record<string, unknown>, media: media as unknown as Record<string, unknown>[], creditsReserved: cost, stage: "Queued" })
    .returning({ id: schema.innovationScans.id });
  try {
    await reserveCredits(userId, cost, innovationCreditRef(scan.id), operationFor(input.mode));
  } catch (err) {
    await db.delete(schema.innovationScans).where(eq(schema.innovationScans.id, scan.id));
    await Promise.all(media.map((m) => deleteUpload(m.key).catch(() => {})));
    throw err;
  }
  try {
    await enqueueInnovation({ scanId: scan.id });
  } catch {
    await refundCredits(userId, innovationCreditRef(scan.id), "innovation scan could not be queued");
    await db.update(schema.innovationScans).set({ status: "failed", error: "Could not queue the scan. Your credits were refunded.", finishedAt: new Date() }).where(eq(schema.innovationScans.id, scan.id));
    throw new ConfigError("redis", ["REDIS_URL (queue unavailable — is Redis running?)"]);
  }
  return { scanId: scan.id };
}

/** Fails and refunds scans whose worker died mid-way (checked whenever the list or a scan is opened). */
async function recoverStale(userId: UserId) {
  const db = getDb();
  const stale = await db
    .select({ id: schema.innovationScans.id })
    .from(schema.innovationScans)
    .where(and(eq(schema.innovationScans.userId, userId), inArray(schema.innovationScans.status, ["queued", "running"]), lt(schema.innovationScans.createdAt, new Date(Date.now() - STALE_MS))));
  for (const s of stale) {
    await db.update(schema.innovationScans).set({ status: "failed", stage: null, error: "The scan took too long and was stopped. Your credits were refunded.", finishedAt: new Date() }).where(eq(schema.innovationScans.id, s.id));
    await refundCredits(userId, innovationCreditRef(s.id), "innovation scan timed out").catch(() => 0);
  }
}

export async function listInnovationScans(userId: UserId) {
  await recoverStale(userId);
  return getDb()
    .select({ id: schema.innovationScans.id, mode: schema.innovationScans.mode, title: schema.innovationScans.title, status: schema.innovationScans.status, stage: schema.innovationScans.stage, ideas: schema.innovationScans.ideas, createdAt: schema.innovationScans.createdAt })
    .from(schema.innovationScans)
    .where(eq(schema.innovationScans.userId, userId))
    .orderBy(desc(schema.innovationScans.createdAt))
    .limit(50);
}

export async function getInnovationScan(userId: UserId, scanId: string): Promise<InnovationScan> {
  if (!/^[0-9a-f-]{36}$/.test(scanId)) throw new NotFoundError("Scan");
  await recoverStale(userId);
  const [row] = await getDb().select().from(schema.innovationScans).where(and(eq(schema.innovationScans.id, scanId), eq(schema.innovationScans.userId, userId))).limit(1);
  if (!row) throw new NotFoundError("Scan");
  return row;
}

export const scanInputOf = (s: Pick<InnovationScan, "input">) => scanInputSchema.parse(s.input);
export const scanMediaOf = (s: Pick<InnovationScan, "media">) => (s.media ?? []) as unknown as ScanMedia[];
export const observationOf = (s: Pick<InnovationScan, "observation">) => (s.observation as unknown as Observation | null) ?? null;
export const ideasOf = (s: Pick<InnovationScan, "ideas">) => (s.ideas ?? []) as unknown as InnovationIdea[];

/** Every storage key that belongs to the scan (uploads and sampled frames): the only keys the media route serves. */
export function scanKeys(s: Pick<InnovationScan, "media">): Set<string> {
  return new Set(scanMediaOf(s).flatMap((m) => [m.key, ...(m.frames ?? []).map((f) => f.key)]));
}

export async function deleteInnovationScan(userId: UserId, scanId: string) {
  const scan = await getInnovationScan(userId, scanId);
  if (scan.status === "queued" || scan.status === "running") throw new UserFacingError("Wait for the scan to finish first.");
  await getDb().delete(schema.innovationScans).where(eq(schema.innovationScans.id, scan.id));
  await Promise.all([...scanKeys(scan)].map((k) => deleteUpload(k).catch(() => {})));
}

/** The idea as a project description: enough for research, design and the rest of Startum to start from. */
function ideaDescription(idea: InnovationIdea, scan: InnovationScan): string {
  const input = scanInputOf(scan);
  const end = (t: string) => t.trim().replace(/[.\s]+$/, "");
  const lines = [idea.oneLiner, ""];
  if (isEnterpriseIdea(idea)) {
    lines.push(`Industry: ${input.industry ?? "—"}. Buyer: ${end(idea.buyer)}.`, `Problem: ${idea.problemArea}`, `Today: ${idea.traditionalToday}`, `Solution: ${idea.solution}`, `First wedge: ${idea.startupAngle}`);
  } else {
    lines.push(`Who pays: ${end(idea.whoPays)}.`, `How it works: ${idea.howItWorks}`, `MVP: ${idea.mvp.map(end).join("; ")}.`, `Who else has this problem: ${idea.marketBreadth}`);
  }
  lines.push("", `From a Traditional → Innovative scan: "${scan.title}".`);
  return lines.join("\n").slice(0, 2000);
}

export async function createProjectFromInnovationIdea(userId: UserId, scanId: string, index: number): Promise<{ projectId: string }> {
  const scan = await getInnovationScan(userId, scanId);
  const idea = ideasOf(scan)[index];
  if (!idea) throw new NotFoundError("Idea");
  const project = await createProject(userId, createProjectSchema.parse({ name: idea.title.slice(0, 80), description: ideaDescription(idea, scan) }));
  return { projectId: project.id };
}
