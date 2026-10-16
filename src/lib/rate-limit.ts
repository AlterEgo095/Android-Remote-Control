// Limitation de tentatives en mémoire (mono-instance) — Android Remote Control v1.0
// Suffisant pour une seule instance console derrière Nginx ; à remplacer par un
// store partagé (Redis) si un jour la console est répliquée.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function nowMs(): number {
  return Date.now();
}

function bucket(key: string, windowMs: number): Bucket {
  const existing = buckets.get(key);
  if (existing && existing.resetAt > nowMs()) return existing;
  const fresh: Bucket = { count: 0, resetAt: nowMs() + windowMs };
  buckets.set(key, fresh);
  return fresh;
}

export interface RateLimitState {
  blocked: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

/** Consultation sans incrément : la tentative est-elle déjà bloquée ? */
export function peekRateLimit(key: string, limit: number, windowMs: number): RateLimitState {
  const b = bucket(key, windowMs);
  return {
    blocked: b.count >= limit,
    count: b.count,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - nowMs()) / 1000)),
  };
}

/** Enregistre une tentative (incrément) et retourne l'état résultant. */
export function hitRateLimit(key: string, limit: number, windowMs: number): RateLimitState {
  const b = bucket(key, windowMs);
  b.count += 1;
  return {
    blocked: b.count > limit,
    count: b.count,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - nowMs()) / 1000)),
  };
}

/** Réinitialise le compteur (appelé après un succès légitime). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
