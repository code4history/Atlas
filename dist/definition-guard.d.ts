/**
 * The longest definition text Atlas hands to PROJ. A PROJ string is a few hundred characters and
 * a WKT2 text a few thousand; the limit also bounds what the per-definition caches can hold.
 */
export declare const MAX_DEFINITION_LENGTH = 16384;
/**
 * Whether a definition text (a PROJ string, a pipeline, WKT, ...) may be handed to PROJ.
 *
 * - It must be a non-empty string of at most `MAX_DEFINITION_LENGTH` characters.
 * - It must not name a resource by URL (`scheme://...`). PROJ treats such a name in a grid
 *   parameter as a file to download, so a definition from an untrusted source could make the
 *   process send a request to a host of its choosing. No definition Atlas produces from proj.db
 *   contains a URL, and neither do the bundled custom projections.
 *
 * A definition that fails this is treated like one PROJ cannot read: the row is skipped when a
 * projection file is loaded, and a transformation to it gives `null`.
 */
export declare function isUsableDefinition(definition: unknown): definition is string;
