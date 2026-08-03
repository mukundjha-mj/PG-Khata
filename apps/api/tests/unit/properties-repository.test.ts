import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPropertyRepository } from "../../src/modules/properties/repository.js";
import type { Database } from "@pgkhata/db";

// Unit tests over the mapping and error branches. The generated SQL and the
// workspace predicate itself need a real database to verify; what is covered
// here is that rows are shaped for the contract and that a silent empty insert
// cannot pass as success.
type Row = {
  id: string;
  workspaceId: string;
  name: string;
  address: string | null;
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function selectDb(rows: Row[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: async () => rows,
  };
  return { select: () => chain } as unknown as Database;
}

function insertDb(returned: Row[]) {
  const values: unknown[] = [];
  const chain = {
    values(input: unknown) {
      values.push(input);
      return chain;
    },
    returning: async () => returned,
  };
  return { db: { insert: () => chain } as unknown as Database, values };
}

const row = (over: Partial<Row> = {}): Row => ({
  id: randomUUID(),
  workspaceId: "ws-1",
  name: "Sunrise PG",
  address: null,
  city: "Noida",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...over,
});

describe("property repository", () => {
  it("serialises timestamps as ISO strings for the contract", async () => {
    const properties = createPropertyRepository(selectDb([row()]));

    const [first] = await properties.list("ws-1");

    expect(first?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(first?.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns an empty list rather than throwing when nothing matches", async () => {
    expect(await createPropertyRepository(selectDb([])).list("ws-1")).toEqual([]);
  });

  it("stamps the caller's workspace onto the inserted row", async () => {
    const { db, values } = insertDb([row({ workspaceId: "ws-1" })]);

    const created = await createPropertyRepository(db).create("ws-1", { name: "Sunrise PG" });

    // The workspace must come from the authenticated identity, never the body.
    expect(values[0]).toMatchObject({ workspaceId: "ws-1", name: "Sunrise PG" });
    expect(created.workspaceId).toBe("ws-1");
  });

  it("throws when the insert returns no row instead of returning undefined", async () => {
    const { db } = insertDb([]);

    await expect(
      createPropertyRepository(db).create("ws-1", { name: "Sunrise PG" }),
    ).rejects.toThrow("Property insert returned no row");
  });
});
