/**
 * A map that holds at most `capacity` keys. Reading or writing a key makes it the most recently
 * used one; when a new key does not fit, the least recently used key is dropped.
 *
 * It only forgets: dropping a key releases nothing. Use `PjCache` for values that own a PROJ object.
 */
export class LruMap<K, V> {
  private readonly entries = new Map<K, V>();
  private readonly capacity: number;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`LruMap capacity must be a positive integer (got ${capacity})`);
    }
    this.capacity = capacity;
  }

  /** The number of keys held. */
  get size(): number {
    return this.entries.size;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  /** Reads a value without making its key the most recently used one. */
  peek(key: K): V | undefined {
    return this.entries.get(key);
  }

  get(key: K): V | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key) as V;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value as K);
    }
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }
}
