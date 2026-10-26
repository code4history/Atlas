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
