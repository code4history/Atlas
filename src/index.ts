export {
  bboxToPolygonWkt,
  extractAuthorityIdFromWkt,
  extractWktName,
  inferApproximateBbox,
  inferDatumFamily,
  inferKind,
  inferPriority,
  inferWgsEquivalent,
  isProjectedPrjPath,
  isScopeIncluded,
} from "./crs-seed.ts";
export { listProjectedCrsFromProjWasm } from "./proj-wasm-crs.ts";

export type { CandidateCrsExtent } from "./crs-types.ts";
export type {
  ListProjectedCrsFromProjWasmOptions,
  ProjectedCrsInfo,
} from "./proj-wasm-crs.ts";
export type {
  CandidateAuthorityId,
  CandidateBbox,
  CandidateDatumFamily,
  CandidateKind,
  CandidateSeedScope,
} from "./crs-seed.ts";
