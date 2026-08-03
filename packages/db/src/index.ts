import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseConnection = { db: Database; sql: Sql };

export function createDatabase(url: string): DatabaseConnection {
  const sql = postgres(url, { max: 10, prepare: false });
  return { db: drizzle(sql, { schema }), sql };
}

export * from "./schema.js";
