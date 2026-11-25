/**
 * A map that holds at most `capacity` keys. Reading or writing a key makes it the most recently
 * used one; when a new key does not fit, the least recently used key is dropped.
 *
 * It only forgets: dropping a key releases nothing. Use `PjCache` for values that own a PROJ object.
 */
export declare class LruMap<K, V> {
    private readonly entries;
    private readonly capacity;
    constructor(capacity: number);
    /** The number of keys held. */
    get size(): number;
    has(key: K): boolean;
    /** Reads a value without making its key the most recently used one. */
    peek(key: K): V | undefined;
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    delete(key: K): boolean;
}
