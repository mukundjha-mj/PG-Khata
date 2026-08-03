import { asc, eq } from "drizzle-orm";
import { properties, type Database } from "@pgkhata/db";
import type { PropertyRepository } from "../../types.js";

function toContract(row: typeof properties.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    address: row.address,
    city: row.city,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createPropertyRepository(db: Database): PropertyRepository {
  return {
    async list(workspaceId) {
      const rows = await db
        .select()
        .from(properties)
        .where(eq(properties.workspaceId, workspaceId))
        .orderBy(asc(properties.name));
      return rows.map(toContract);
    },
    async create(workspaceId, input) {
      const [row] = await db
        .insert(properties)
        .values({ workspaceId, ...input })
        .returning();
      if (!row) throw new Error("Property insert returned no row");
      return toContract(row);
    },
  };
}
