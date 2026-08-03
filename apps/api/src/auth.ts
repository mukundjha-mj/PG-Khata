import type { Request } from "express";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@pgkhata/db";
import { workspaceMemberships } from "@pgkhata/db";
import { eq } from "drizzle-orm";
import type { AppEnv } from "@pgkhata/config";
import type { Authenticate } from "./types.js";

export function createAuth(db: Database, env: AppEnv) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.API_BASE_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    advanced: { useSecureCookies: env.NODE_ENV === "production" },
  });
}

export function createAuthenticate(
  auth: ReturnType<typeof createAuth>,
  db: Database,
): Authenticate {
  return async (request: Request) => {
    const session = await auth.api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });
    if (!session) return null;
    const [membership] = await db
      .select()
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.userId, session.user.id))
      .limit(1);
    return membership
      ? { userId: session.user.id, workspaceId: membership.workspaceId, role: membership.role }
      : null;
  };
}
