import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadEnv } from "@pgkhata/config";
import { createLogger } from "@pgkhata/config/logger";
import { createDatabase } from "@pgkhata/db";
import { publishPendingOutbox } from "./outbox.js";
import { QUEUE_NAMES, type OutboxJob } from "./queues.js";

const env = loadEnv();
const logger = createLogger(env).child({ service: "pgkhata-worker" });
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const connection = createDatabase(env.DATABASE_URL);
const queue = new Queue<OutboxJob>(QUEUE_NAMES.outbox, { connection: redis });
const worker = new Worker<OutboxJob>(
  QUEUE_NAMES.outbox,
  async (job) => {
    // Topic-specific processors are added using TDD as each legacy module moves.
    logger.info({ jobId: job.id, eventId: job.data.eventId }, "Outbox event received");
  },
  { connection: redis, concurrency: 10 },
);

worker.on("failed", (job, error) => logger.error({ err: error, jobId: job?.id }, "Job failed"));
const timer = setInterval(async () => {
  try {
    const count = await publishPendingOutbox(connection.db, queue);
    if (count) logger.info({ count }, "Published outbox events");
  } catch (error) {
    logger.error({ err: error }, "Outbox publication failed");
  }
}, 1_000);
timer.unref();

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  clearInterval(timer);
  await worker.close();
  await queue.close();
  await redis.quit();
  await connection.sql.end();
}
process.on("SIGINT", () => void shutdown("SIGINT").then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown("SIGTERM").then(() => process.exit(0)));
