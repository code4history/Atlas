/** The part of proj-wasm that `withPj` needs: releasing a PJ object. */
export interface PjDestroyer {
    projDestroy(args: {
        pj: unknown;
    }): unknown;
}
/**
 * Creates a PROJ object, hands it to `use`, and always releases it with `proj_destroy`
 * afterwards, whether `use` returns or throws. Nothing is released when `create` throws
 * or returns no object.
 */
export declare function withPj<T>(proj: PjDestroyer, create: () => unknown, use: (pj: unknown) => T | Promise<T>): Promise<T>;
