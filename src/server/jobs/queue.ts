import "server-only";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getEnv, requireIntegration } from "@/lib/env";

export const RESEARCH_QUEUE = "research";
export type ResearchJobData = { jobId: string };
export const PAIN_MINING_QUEUE = "pain-mining";
export type PainMiningJobData = { sessionId: string; attempt: number };

const g = globalThis as unknown as { __researchQueue?: Queue<ResearchJobData>; __miningQueue?: Queue<PainMiningJobData> };

/** BullMQ needs connections with maxRetriesPerRequest: null. */
export function createQueueConnection(): Redis {
  requireIntegration("redis");
  return new Redis(getEnv().REDIS_URL!, { maxRetriesPerRequest: null });
}

let enqueueOverride: ((jobId: string) => Promise<void>) | null = null;
/** Tests only: replace enqueueing (e.g. to run jobs inline). */
export function __setEnqueueOverride(fn: typeof enqueueOverride) {
  enqueueOverride = fn;
}

export async function enqueueResearch(jobId: string): Promise<void> {
  if (enqueueOverride) return enqueueOverride(jobId);
  g.__researchQueue ??= new Queue<ResearchJobData>(RESEARCH_QUEUE, { connection: createQueueConnection() });
  // Use our job id as the BullMQ id so a job can never be queued twice.
  await g.__researchQueue.add("run", { jobId }, { jobId, attempts: 1, removeOnComplete: 200, removeOnFail: 500 });
}

let miningOverride: ((data: PainMiningJobData) => Promise<void>) | null = null;
/** Tests only. */
export function __setMiningEnqueueOverride(fn: typeof miningOverride) {
  miningOverride = fn;
}

export async function enqueuePainMining(data: PainMiningJobData): Promise<void> {
  if (miningOverride) return miningOverride(data);
  g.__miningQueue ??= new Queue<PainMiningJobData>(PAIN_MINING_QUEUE, { connection: createQueueConnection() });
  await g.__miningQueue.add("run", data, { jobId: `${data.sessionId}-${data.attempt}`, attempts: 1, removeOnComplete: 200, removeOnFail: 500 });
}
