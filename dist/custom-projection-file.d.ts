import { CustomProjectionDefinition } from "./proj-wasm-crs";
/** The largest projection definition resource that is read, in bytes (and in characters of text). */
export declare const MAX_PROJECTION_RESOURCE_BYTES: number;
/**
 * Loads a projection definition file: a JSON array of rows, or an object with such an array in
 * `projections`. Rows that are not usable are skipped (see `readDefinition`).
 *
 * `trusted` is for the file bundled with Atlas, which is read from wherever the package is served.
 * A caller-given resource must be at an allowed location (see `assertAllowedLocation`).
 *
 * Error messages name the resource without credentials, query string or content.
 */
export declare function loadCustomProjectionFile(resource: string | URL, options?: {
    trusted?: boolean;
}): Promise<CustomProjectionDefinition[]>;
