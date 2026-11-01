/** The part of proj-wasm that `withPj` needs: releasing a PJ object. */
export interface PjDestroyer {
    projDestroy(args: {
        pj: unknown;
    }): unknown;
}
/**
 * Creates a PROJ object, hands it to `use`, and always releases it with `proj_destroy`
 * afterwards, whether `use` returns or throws. Nothing is released when `create` throws
 * or returns no object. A failure to release never replaces the outcome of `use`: its
 * result is returned, or its error is rethrown.
 */
export declare function withPj<T>(proj: PjDestroyer, create: () => unknown, use: (pj: unknown) => T | Promise<T>): Promise<T>;
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
export declare class PjCache<K> {
    private readonly entries;
    private readonly capacity;
    constructor(capacity: number);
    /** The number of keys held. */
    get size(): number;
    use<T>(proj: PjDestroyer, key: K, create: () => unknown, use: (pj: unknown) => T | Promise<T>): Promise<T>;
    private createObject;
    private evictOverflow;
    private release;
}
