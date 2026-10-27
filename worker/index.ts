/**
 * Background worker: runs long research jobs off the request path.
 * Start with `pnpm worker` (dev) — runs under the react-server condition so
 * server-only modules load outside Next.js.
 */
import { Worker } from "bullmq";
import { createQueueConnection, PAIN_MINING_QUEUE, RESEARCH_QUEUE, type PainMiningJobData, type ResearchJobData } from "@/server/jobs/queue";
import { runPainMining } from "@/server/jobs/gold-mine/pain-miner";
import { recoverStaleJobs, runResearchJob } from "@/server/jobs/research/pipeline";
import { isMarketplaceEnabled } from "@/server/marketplace/config";
import { autoConfirmDueDeals } from "@/server/marketplace/deals";

async function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
  console.log("[worker] Sentry enabled");
}

async function main() {
  await initSentry();
  const recovered = await recoverStaleJobs();
  if (recovered) console.log(`[worker] marked ${recovered} stale job(s) as failed and refunded them`);

  const worker = new Worker<ResearchJobData>(RESEARCH_QUEUE, async (job) => runResearchJob(job.data.jobId), {
    connection: createQueueConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  });
  const miner = new Worker<PainMiningJobData>(PAIN_MINING_QUEUE, async (job) => runPainMining(job.data.sessionId, job.data.attempt), {
    connection: createQueueConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  });
  miner.on("failed", (job, err) => console.error(`[worker] pain mining ${job?.data.sessionId} crashed:`, err.message));
  worker.on("ready", () => console.log("[worker] ready, waiting for research jobs"));
  worker.on("completed", (job) => console.log(`[worker] job ${job.data.jobId} finished`));
  worker.on("failed", (job, err) => console.error(`[worker] job ${job?.data.jobId} crashed:`, err.message));

  // Periodically clean up jobs orphaned by crashes.
  const sweep = setInterval(() => void recoverStaleJobs().catch(() => {}), 5 * 60_000);

  // Marketplace: confirm deals whose buyer-confirmation window passed without a dispute, then pay out.
  const confirmDeals = () =>
    void autoConfirmDueDeals()
      .then((n) => n && console.log(`[worker] auto-confirmed ${n} marketplace deal(s)`))
      .catch((err) => console.error("[worker] marketplace auto-confirm failed:", err instanceof Error ? err.message : err));
  const marketplace = isMarketplaceEnabled() ? setInterval(confirmDeals, 60 * 60_000) : null;

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, finishing current jobs…`);
    clearInterval(sweep);
    if (marketplace) clearInterval(marketplace);
    await Promise.all([worker.close(), miner.close()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] failed to start:", err);
  process.exit(1);
});
