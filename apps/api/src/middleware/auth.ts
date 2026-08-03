import type { NextFunction, Request, Response } from "express";
import type { Authenticate } from "../types.js";
import { ApiError } from "../errors.js";

export function requireIdentity(authenticate: Authenticate) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const identity = await authenticate(request);
      if (!identity) throw new ApiError(401, "Unauthorized", "Authentication is required.");
      request.identity = identity;
      next();
    } catch (error) {
      next(error);
    }
  };
}
