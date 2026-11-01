/** The part of proj-wasm that `withPj` needs: releasing a PJ object. */
export interface PjDestroyer {
  projDestroy(args: { pj: unknown }): unknown;
}

/**
 * Creates a PROJ object, hands it to `use`, and always releases it with `proj_destroy`
 * afterwards, whether `use` returns or throws. Nothing is released when `create` throws
 * or returns no object. A failure to release never replaces the outcome of `use`: its
 * result is returned, or its error is rethrown.
 */
export async function withPj<T>(
  proj: PjDestroyer,
  create: () => unknown,
  use: (pj: unknown) => T | Promise<T>,
): Promise<T> {
  const pj = await create();
  try {
    return await use(pj);
  } finally {
    if (pj !== undefined && pj !== null) {
      try {
        await proj.projDestroy({ pj });
      } catch {
        // The object is lost either way; keep the outcome of `use`.
      }
    }
  }
}

interface PjCacheEntry {
  object: Promise<unknown>;
  /** Uses that have started and not finished yet. */
  users: number;
  /** True once the entry has left the cache; the object is released when its last use ends. */
  evicted: boolean;
  released: boolean;
}

/**
 * Keeps PROJ objects that are expensive to create (or, in proj-wasm 0.1.0-alpha8, that leave memory
 * behind every time one is created and released) and lends them out by key.
 *
 * - One object is created per key; uses that start at the same time share that creation.
 * - When the cache holds more than `capacity` keys, the least recently used key leaves it. Its object
 *   is released with `proj_destroy` once every use that is still running has finished.
 * - When `create` throws, or returns no object, `use` rejects and nothing is remembered: the next use
 *   of that key tries to create the object again.
 * - When `use` throws, the error is passed on and the object stays in the cache.
 *
 * Every proj-wasm call is one message that the worker owning the object runs to completion, so uses
 * that overlap in time never interleave inside a call. Callers must not keep state in the object
 * between calls.
 */
export class PjCache<K> {
  private readonly entries = new Map<K, PjCacheEntry>();
  private readonly capacity: number;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`PjCache capacity must be a positive integer (got ${capacity})`);
    }
    this.capacity = capacity;
  }

  /** The number of keys held. */
  get size(): number {
    return this.entries.size;
  }

  async use<T>(
    proj: PjDestroyer,
    key: K,
    create: () => unknown,
    use: (pj: unknown) => T | Promise<T>,
  ): Promise<T> {
    let entry = this.entries.get(key);
    if (entry === undefined) {
      entry = { object: this.createObject(key, create), users: 0, evicted: false, released: false };
      this.entries.set(key, entry);
      this.evictOverflow(proj);
    } else {
      // Mark as the most recently used.
      this.entries.delete(key);
      this.entries.set(key, entry);
    }

    entry.users += 1;
    try {
      let pj: unknown;
      try {
        pj = await entry.object;
      } catch (error) {
        if (this.entries.get(key) === entry) this.entries.delete(key);
        entry.released = true; // nothing was created
        throw error;
      }
      return await use(pj);
    } finally {
      entry.users -= 1;
      if (entry.evicted && entry.users === 0) await this.release(proj, entry);
    }
  }

  private async createObject(key: K, create: () => unknown): Promise<unknown> {
    const pj = await create();
    if (pj === undefined || pj === null) {
      throw new Error(`The PROJ object for ${String(key)} could not be created`);
    }
    return pj;
  }

  private evictOverflow(proj: PjDestroyer): void {
    while (this.entries.size > this.capacity) {
      const [oldestKey, oldest] = this.entries.entries().next().value as [K, PjCacheEntry];
      this.entries.delete(oldestKey);
      oldest.evicted = true;
      if (oldest.users === 0) void this.release(proj, oldest);
    }
  }

  private async release(proj: PjDestroyer, entry: PjCacheEntry): Promise<void> {
    if (entry.released) return;
    entry.released = true;
    try {
      await proj.projDestroy({ pj: await entry.object });
    } catch {
      // Creation failed (nothing to release) or releasing failed; the object is lost either way.
    }
  }
}
