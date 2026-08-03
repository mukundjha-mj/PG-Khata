import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  API_BASE_URL: z.string().url().default("http://localhost:3001"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().default("pgkhata-private"),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: booleanFromString,
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  BUILD_SHA: z.string().default("local"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  // Name the offending variables without printing their values — a startup
  // failure gets read from logs and pasted into issues.
  const lines = parsed.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    return `  ${name}: ${issue.message}`;
  });
  throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
}
