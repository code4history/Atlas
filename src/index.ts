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
export {
  initializeProjWasmRuntime,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
} from "./proj-wasm-crs.ts";

export type { CandidateCrsExtent } from "./crs-types.ts";
export type {
  InitializeProjWasmRuntimeOptions,
  ListProjectedCrsFromProjWasmOptions,
  ProjectedCrsInfo,
  TransformLonLatToProjectedOptions,
} from "./proj-wasm-crs.ts";
export type {
  CandidateAuthorityId,
  CandidateBbox,
  CandidateDatumFamily,
  CandidateKind,
  CandidateSeedScope,
} from "./crs-seed.ts";
