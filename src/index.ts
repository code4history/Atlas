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
  createCandidateTransformer,
  initializeProjWasmRuntime,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  transformLonLatToCandidate,
} from "./proj-wasm-crs.ts";

export type { CandidateCrsExtent } from "./crs-types.ts";
export type {
  AtlasCandidateTransformer,
  AtlasGeoBasisLike,
  InitializeProjWasmRuntimeOptions,
  LinearUnit,
  ListProjectedCrsFromProjWasmOptions,
  ProjectedCrsExclusion,
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
