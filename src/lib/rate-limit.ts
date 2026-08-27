/**
 * rate-limit.ts — Limitation de débit côté serveur (module-level Map en Node runtime)
 * Clé dérivée de user.id résolu côté serveur, jamais d'un header client brut.
 * NE FONCTIONNE PAS sur Edge runtime (pas de module-level state persistant).
 * Pour Edge, utiliser Upstash Redis ou déplacer la route en Node runtime.
 */

import { RATE_LIMIT } from './constants';

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp en ms
}

// Stockage en mémoire (Node runtime uniquement)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Nettoie les entrées expirées toutes les minutes pour éviter une fuite mémoire.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000); // 1 minute

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Vérifie si une requête peut passer sous la limite de débit.
 * La clé doit être `user:${userId}` — JAMAIS une IP ou un header client.
 */
export function checkRateLimit(
  key: string,
  limit: number = RATE_LIMIT.DEFAULT_RPM
): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Nouvelle fenêtre
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
      limit,
    };
  }

  if (entry.count >= limit) {
    // Dépassement
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit,
    };
  }

  // Incrémente
  entry.count += 1;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    limit,
  };
}

/**
 * Helper pour extraire le user.id depuis une session Supabase (auth serveur).
 * À utiliser dans les API routes pour construire la clé de rate-limit.
 */
export function getRateLimitKey(userId: string, scope: string = 'default'): string {
  if (!userId) {
    throw new Error('rate-limit : userId requis pour construire la clé');
  }
  return `user:${userId}:${scope}`;
}

export interface RateLimitByUserResult {
  success: boolean;
  retryAfter: number; // en ms si success=false
}

/**
 * Wrapper pratique pour rate-limiter par user_id + scope.
 * Retourne { success: true } si OK, { success: false, retryAfter: ms } sinon.
 */
export async function rateLimitByUser(
  userId: string,
  scope: string = 'default',
  limit?: number
): Promise<RateLimitByUserResult> {
  const key = getRateLimitKey(userId, scope);
  const result = checkRateLimit(key, limit);

  if (result.allowed) {
    return { success: true, retryAfter: 0 };
  } else {
    const retryAfter = result.resetAt - Date.now();
    return { success: false, retryAfter: Math.max(retryAfter, 0) };
  }
}
