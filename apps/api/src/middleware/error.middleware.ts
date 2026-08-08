import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error.js";

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  const diagnostic = error instanceof Error ? error.message : "Unexpected server error.";
  console.error("API error:", error);
  const message = process.env.NODE_ENV === "production" ? "The server could not complete this request." : diagnostic;
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
}
