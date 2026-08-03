import type { Logger } from "pino";
import type { Request } from "express";
import type { Property } from "@pgkhata/contracts";

export type Identity = { userId: string; workspaceId: string; role: "owner" | "manager" };
export type Authenticate = (request: Request) => Promise<Identity | null>;

export interface PropertyRepository {
  list(workspaceId: string): Promise<Property[]>;
  create(
    workspaceId: string,
    input: { name: string; address?: string | null | undefined; city?: string | null | undefined },
  ): Promise<Property>;
}

export type ApiDependencies = {
  logger: Logger;
  authenticate: Authenticate;
  properties: PropertyRepository;
  ready: () => Promise<boolean>;
  buildSha: string;
  webOrigin: string;
};

declare global {
  namespace Express {
    interface Request {
      identity?: Identity;
      requestId: string;
    }
  }
}
