import { Response } from 'express';

/**
 * Logs the real error server-side (full stack included) and sends a sanitized
 * response so internal details — file paths, err.message, stack traces — never
 * reach the client.
 *
 * Use this for every catch block in route handlers instead of forwarding
 * err.message directly.
 */
export function sendSafeError(
  res: Response,
  err: unknown,
  publicMessage: string,
  statusCode = 500
): void {
  // Always log the real error for server-side diagnostics
  console.error(`[SentraScan Error] ${publicMessage}`);
  if (err instanceof Error) {
    console.error(err.stack ?? err.message);
  } else {
    console.error(err);
  }

  if (!res.headersSent) {
    res.status(statusCode).json({ error: publicMessage });
  }
}
