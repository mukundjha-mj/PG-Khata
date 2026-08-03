import { sql as query } from "drizzle-orm";
import { toNodeHandler } from "better-auth/node";
import { loadEnv } from "@pgkhata/config";
import { createLogger } from "@pgkhata/config/logger";
import { createDatabase } from "@pgkhata/db";
import { createApp } from "./app.js";
import { createAuth, createAuthenticate } from "./auth.js";
import { createPropertyRepository } from "./modules/properties/repository.js";

const env = loadEnv();
const logger = createLogger(env);
const connection = createDatabase(env.DATABASE_URL);
const auth = createAuth(connection.db, env);
const app = createApp({
  logger,
  authenticate: createAuthenticate(auth, connection.db),
  properties: createPropertyRepository(connection.db),
  ready: async () => {
    await connection.db.execute(query`select 1`);
    return true;
  },
  buildSha: env.BUILD_SHA,
  webOrigin: env.WEB_ORIGIN,
});

app.all("/api/auth/*splat", toNodeHandler(auth));
const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info({ host: env.API_HOST, port: env.API_PORT }, "API listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "API shutting down");
  server.close(async () => {
    await connection.sql.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
