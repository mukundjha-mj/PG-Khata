import { randomUUID } from "node:crypto";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { ApiDependencies, PropertyRepository } from "../../src/types.js";

const workspaceId = randomUUID();

function dependencies(overrides: Partial<ApiDependencies> = {}): ApiDependencies {
  const rows: Awaited<ReturnType<PropertyRepository["list"]>> = [];
  const properties: PropertyRepository = {
    async list(requestedWorkspace) {
      return rows.filter((row) => row.workspaceId === requestedWorkspace);
    },
    async create(requestedWorkspace, input) {
      const now = new Date().toISOString();
      const row = { id: randomUUID(), workspaceId: requestedWorkspace, name: input.name, address: input.address ?? null, city: input.city ?? null, createdAt: now, updatedAt: now };
      rows.push(row);
      return row;
    },
  };
  return {
    logger: pino({ enabled: false }),
    authenticate: async (req) => req.get("authorization") === "Bearer valid" ? { userId: "user-1", workspaceId, role: "owner" } : null,
    properties,
    ready: async () => true,
    buildSha: "test-sha",
    webOrigin: "http://localhost:3000",
    ...overrides,
  };
}

describe("API application", () => {
  it("reports liveness and propagates a request id", async () => {
    const response = await request(createApp(dependencies())).get("/health/live").set("x-request-id", "trace-1");
    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("trace-1");
    expect(response.body).toMatchObject({ status: "ok", version: "test-sha" });
  });

  it("reports a failed readiness dependency", async () => {
    const response = await request(createApp(dependencies({ ready: async () => false }))).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body.checks.database).toBe("down");
  });

  it("rejects unauthenticated property access with a problem response", async () => {
    const response = await request(createApp(dependencies())).get("/api/v1/properties");
    expect(response.status).toBe(401);
    expect(response.type).toBe("application/problem+json");
    expect(response.body).toMatchObject({ title: "Unauthorized", status: 401 });
  });

  it("creates and lists properties only in the authenticated workspace", async () => {
    const app = createApp(dependencies());
    const created = await request(app).post("/api/v1/properties").set("authorization", "Bearer valid").send({ name: "Sunrise PG", city: "Noida" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Sunrise PG", workspaceId });

    const listed = await request(app).get("/api/v1/properties").set("authorization", "Bearer valid");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].workspaceId).toBe(workspaceId);
  });

  it("returns field validation errors for invalid input", async () => {
    const response = await request(createApp(dependencies())).post("/api/v1/properties").set("authorization", "Bearer valid").send({ name: "" });
    expect(response.status).toBe(400);
    expect(response.body.type).toContain("validation");
    expect(response.body.errors.name).toBeDefined();
  });
});
