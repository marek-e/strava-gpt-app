/**
 * Tiny in-memory TTL cache with single-flight dedup. Keyed by string.
 * Suitable for single-instance v1; swap for a real KV when we go multi-instance.
 */

interface Entry<T> {
  value: T;
  expiresAt: number; // epoch ms; Infinity = never expires
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  /** `ttlMs = Infinity` means cache forever (use for immutable data like activity detail). */
  async getOrLoad(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const inFlight = this.inFlight.get(key);
    if (inFlight) return inFlight;

    const promise = load()
      .then((value) => {
        this.store.set(key, {
          value,
          expiresAt:
            ttlMs === Infinity ? Infinity : Date.now() + ttlMs,
        });
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.inFlight.clear();
  }
}
