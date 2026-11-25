/**
 * The longest definition text Atlas hands to PROJ. A PROJ string is a few hundred characters and
 * a WKT2 text a few thousand; the limit also bounds what the per-definition caches can hold.
 */
export const MAX_DEFINITION_LENGTH = 16_384;

/**
 * Whether a definition text may be handed to PROJ. Atlas hands over PROJ strings (a CRS or a
 * pipeline) and WKT; PROJJSON is not supported.
 *
 * - It must be a non-empty string of at most `MAX_DEFINITION_LENGTH` characters.
 * - It must not name a resource by URL (`scheme://...`): PROJ would treat such a file name as
 *   something to download.
 * - It must not contain a backslash, and must not be in a JSON form (start with `{` or `[`).
 *   Neither a PROJ string nor WKT needs a backslash, and in a JSON form the same text can be
 *   spelled in ways the check above does not see.
 *
 * No definition Atlas produces from proj.db fails this, and neither do the bundled custom
 * projections. A definition that fails it is treated like one PROJ cannot read: the row is skipped
 * when a projection file is loaded, and a transformation to it gives `null`.
 */
export function isUsableDefinition(definition: unknown): definition is string {
  if (typeof definition !== "string") return false;
  if (definition.length === 0 || definition.length > MAX_DEFINITION_LENGTH) return false;
  if (definition.includes("://") || definition.includes("\\")) return false;
  const first = definition.trimStart()[0];
  return first !== "{" && first !== "[";
}
