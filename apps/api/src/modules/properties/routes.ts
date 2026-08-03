import { Router } from "express";
import { createPropertySchema, propertyListSchema, propertySchema } from "@pgkhata/contracts";
import type { Authenticate, PropertyRepository } from "../../types.js";
import { requireIdentity } from "../../middleware/auth.js";

export function createPropertyRouter(input: {
  authenticate: Authenticate;
  properties: PropertyRepository;
}): Router {
  const router = Router();
  router.use(requireIdentity(input.authenticate));

  router.get("/", async (request, response, next) => {
    try {
      const rows = await input.properties.list(request.identity!.workspaceId);
      response.json(propertyListSchema.parse({ data: rows, nextCursor: null }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const body = createPropertySchema.parse(request.body);
      const property = await input.properties.create(request.identity!.workspaceId, body);
      response.status(201).json(propertySchema.parse(property));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
