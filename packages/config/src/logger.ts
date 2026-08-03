import { pino, type Logger } from "pino";
import type { AppEnv } from "./index.js";

const redact = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "password",
  "token",
  "secret",
];

export function createLogger(env: Pick<AppEnv, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact,
    base: { service: "pgkhata-api", environment: env.NODE_ENV },
  });
}
