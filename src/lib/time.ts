/**
 * Request-time clock for Server Components (each render is a single request,
 * so reading the clock here is deterministic for that response).
 */
export function nowMs(): number {
  return Date.now();
}
export const DAY_MS = 86_400_000;
