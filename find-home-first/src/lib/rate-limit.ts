// Simple in-memory rate limiter. Keyed by "{scope}:{windowMinute}".
// Works in Next.js server actions (Node.js runtime).
const _store = new Map<string, number>();

export function checkRateLimit(
  scope: string,
  maxPerMinute: number
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60000);
  const key = `${scope}:${minute}`;
  const current = _store.get(key) ?? 0;
  if (current >= maxPerMinute) {
    return { allowed: false, remaining: 0, resetInSeconds: 60 - now.getSeconds() };
  }
  _store.set(key, current + 1);
  // Cleanup old keys (keep only current and previous minute)
  for (const k of _store.keys()) {
    const km = parseInt(k.split(":").pop() ?? "0", 10);
    if (minute - km > 1) _store.delete(k);
  }
  return { allowed: true, remaining: maxPerMinute - current - 1, resetInSeconds: 60 - now.getSeconds() };
}
