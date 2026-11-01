/** The WKT block of the candidate detail. */
export function wktText(row: { wkt2: string | null; definitionType?: string }): string {
  if (row.wkt2) return row.wkt2;
  if (row.definitionType === "custom" || row.definitionType === "user") {
    return `No WKT2 definition for this ${row.definitionType} projection.`;
  }
  return "WKT2 is not available for this proj.db entry in the bundled proj-wasm runtime.";
}
