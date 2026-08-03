import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./index.js";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const { db, sql } = createDatabase(databaseUrl);
try {
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
} finally {
  await sql.end();
}
