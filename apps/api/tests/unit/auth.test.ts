import { describe, expect, it, vi } from "vitest";
import { createAuthenticate } from "../../src/auth.js";
import type { Database } from "@pgkhata/db";

// These are unit tests. They exercise the branching and the shape of what the
// caller gets back; they do NOT verify the generated SQL, which needs a real
// database. The `calls` log is the closest stand-in: it asserts the query was
// built in the expected order.
function fakeDb(rows: unknown[]) {
  const calls: string[] = [];
  const chain = {
    from() {
      calls.push("from");
      return chain;
    },
    where() {
      calls.push("where");
      return chain;
    },
    orderBy() {
      calls.push("orderBy");
      return chain;
    },
    limit() {
      calls.push("limit");
      return chain;
    },
    then(resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(rows).then(resolve, reject);
    },
  };
  const db = {
    select() {
      calls.push("select");
      return chain;
    },
  };
  return { calls, db: db as unknown as Database };
}

function fakeAuth(session: unknown) {
  const getSession = vi.fn(async (_options: { headers: Headers }) => session);
  return { auth: { api: { getSession } } as never, getSession };
}

const session = { user: { id: "user-1" } };
const membership = { workspaceId: "ws-1", userId: "user-1", role: "owner" as const };

describe("createAuthenticate", () => {
  it("returns null and never queries when there is no session", async () => {
    const { calls, db } = fakeDb([membership]);
    const { auth } = fakeAuth(null);

    const identity = await createAuthenticate(auth, db)({ headers: {} } as never);

    expect(identity).toBeNull();
    // An unauthenticated request must not reach the database at all.
    expect(calls).toEqual([]);
  });

  it("returns null when the user has no workspace membership", async () => {
    const { db } = fakeDb([]);
    const { auth } = fakeAuth(session);

    expect(await createAuthenticate(auth, db)({ headers: {} } as never)).toBeNull();
  });

  it("returns the identity for a member", async () => {
    const { db } = fakeDb([membership]);
    const { auth } = fakeAuth(session);

    expect(await createAuthenticate(auth, db)({ headers: {} } as never)).toEqual({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
    });
  });

  it("orders the membership lookup before limiting it", async () => {
    const { calls, db } = fakeDb([membership]);
    const { auth } = fakeAuth(session);

    await createAuthenticate(auth, db)({ headers: {} } as never);

    // A user in two workspaces must not get an arbitrary one: without an
    // explicit order, `limit(1)` picks whichever row Postgres returns first,
    // so the same request could resolve to a different tenant between calls.
    expect(calls).toEqual(["select", "from", "where", "orderBy", "limit"]);
  });

  it("forwards request headers to the session lookup", async () => {
    const { db } = fakeDb([membership]);
    const { auth, getSession } = fakeAuth(session);

    await createAuthenticate(auth, db)({ headers: { cookie: "session=abc" } } as never);

    const passed = getSession.mock.calls[0]?.[0];
    expect(passed?.headers.get("cookie")).toBe("session=abc");
  });
});
