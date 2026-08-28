export { bboxToPolygonWkt, extractAuthorityIdFromWkt, extractWktName, inferApproximateBbox, inferDatumFamily, inferKind, inferPriority, inferWgsEquivalent, isProjectedPrjPath, isScopeIncluded, } from "./crs-seed";
export { initializeProjWasmRuntime, listProjectedCrsFromProjWasm, transformLonLatArrayToProjected, } from "./proj-wasm-crs";
export type { CandidateCrsExtent } from "./crs-types";
export type { InitializeProjWasmRuntimeOptions, ListProjectedCrsFromProjWasmOptions, ProjectedCrsInfo, TransformLonLatToProjectedOptions, } from "./proj-wasm-crs";
export type { CandidateAuthorityId, CandidateBbox, CandidateDatumFamily, CandidateKind, CandidateSeedScope, } from "./crs-seed";
