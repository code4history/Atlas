import { CandidateCrsExtent } from "./crs-types";
export interface ProjectedCrsInfo {
    id: string;
    authority: string;
    code: string;
    name: string;
    areaName: string;
    deprecated: boolean;
    bbox: CandidateCrsExtent;
    wkt2: string | null;
    proj4: string;
    pipeline?: string;
    isApproximate?: boolean;
    source?: string[];
    definitionType?: "projdb" | "custom" | "user";
}
/** A proj.db row that matched the search but was left out of the result, with the reason. */
export interface ProjectedCrsExclusion {
    id: string;
    name: string;
    reason: string;
}
export interface ListProjectedCrsFromProjWasmOptions {
    extent: CandidateCrsExtent;
    area?: string;
    includeDeprecated?: boolean;
    /**
     * Keep proj.db rows whose CRS is defined on another celestial body (the Moon, Mars, ... :
     * most of the IAU_2015 authority and a few ESRI rows). Default `false`.
     *
     * They are left out by default because the source of every transformation is WGS 84 (the Earth):
     * PROJ has no operation from the Earth to them, and with the bundled proj-wasm runtime the
     * exceptions this raises pile up until the runtime stops answering. The test uses the celestial
     * body proj.db gives for the CRS (`ellipsoid.celestial_body_auth_name/code` -> `celestial_body.name`,
     * reported as `celestialBodyName`), so no PROJ object is created for the rows left out.
     *
     * When you keep them, do not pass such rows in bulk to `transformLonLatArrayToProjected`, nor
     * through `createCandidateTransformer` to the `estimateCrs` of Teiresias (`estimateCrs` transforms
     * every candidate it is given).
     */
    includeOtherCelestialBodies?: boolean;
    onshoreOnly?: boolean;
    bboxPaddingDeg?: number;
    includeCustomProjections?: boolean;
    userProjection?: string | URL;
    /** @deprecated Use userProjection with a file://, https://, or data: URI. */
    userProjectionFile?: string;
    projWasmAssetBaseUrl?: string | URL;
    /**
     * Called once per search with the proj.db rows that matched the search but were left out:
     * rows of another celestial body (reason `Not on the Earth (celestial body: <name>)`, unless
     * `includeOtherCelestialBodies` is set) and rows whose PROJ string cannot be exported by the
     * bundled proj-wasm runtime (reason `Unsupported conversion method: ...`).
     */
    onExcluded?: (excluded: ProjectedCrsExclusion[]) => void;
}
export interface InitializeProjWasmRuntimeOptions {
    projWasmAssetBaseUrl?: string | URL;
}
export interface TransformLonLatToProjectedOptions {
    projWasmAssetBaseUrl?: string | URL;
}
export interface ProjDatabaseRow {
    authName: string;
    code: string;
    name: string;
    type: number;
    deprecated: boolean;
    bboxValid: boolean;
    westLonDegree: number;
    southLatDegree: number;
    eastLonDegree: number;
    northLatDegree: number;
    areaName: string;
    /**
     * Name of the celestial body of the CRS (from proj.db: ellipsoid -> celestial_body), e.g. `Earth`, `Moon`.
     * A row without it (a synthetic row of a custom projection) is treated as on the Earth.
     */
    celestialBodyName?: string | null;
}
export interface CustomProjectionDefinition {
    authority: string;
    code: string;
    name: string;
    areaName: string;
    deprecated: boolean;
    bbox: CandidateCrsExtent;
    proj4?: string;
    pipeline?: string;
    wkt2?: string | null;
    isApproximate?: boolean;
    source?: string[];
}
export declare function filterProjectedCrsRows(rows: ProjDatabaseRow[], options: ListProjectedCrsFromProjWasmOptions): ProjDatabaseRow[];
export declare function initializeProjWasmRuntime(options?: InitializeProjWasmRuntimeOptions): Promise<void>;
export declare function listProjectedCrsFromProjWasm(options: ListProjectedCrsFromProjWasmOptions): Promise<ProjectedCrsInfo[]>;
/**
 * lon/lat（度・lon-lat 順）の点列を、target CRS の投影座標 `[easting, northing]` へ一括変換する。
 *
 * 契約:
 * - (3) 返却は常に `[easting, northing]` 順である（proj 文字列 pipeline により機構で保証する）。
 * - (4) 空入力・業務的に変換不能な target は `null`。
 * - (5) 部分成功はしない。入力または出力に非有限成分が 1 つでもあれば全体 `null`。
 * - (7) `null` は業務的に変換不能なとき（上の (4)(5)）だけに使う。実装側の理由で変換できない
 *   とき（PJ を作れない・proj-wasm の呼び出しが throw する。wasm のメモリが尽きた場合を含む）は
 *   `null` にせず throw する。
 * - (8) 出力は入力と同数・同順。
 *
 * 本 export は **`lonlat_deg` / lon-lat 順の入力専用**である。`planar_xy` 入力の
 * 実 engine 経路は持たない。
 */
export declare function transformLonLatArrayToProjected(target: Pick<ProjectedCrsInfo, "id" | "proj4">, points: ReadonlyArray<readonly [number, number]>, options?: TransformLonLatToProjectedOptions): Promise<Array<[number, number]> | null>;
/** The geo basis of the points given to a candidate transformer (structurally compatible with Teiresias' `GeoBasis`). */
export type AtlasGeoBasisLike = {
    kind: string;
    axisOrder?: string;
};
/** A transformer with the same shape as Teiresias' `CandidateTransformer`. */
export type AtlasCandidateTransformer = (id: string, points: ReadonlyArray<readonly [number, number]>, geoBasis: AtlasGeoBasisLike) => Promise<Array<[number, number]> | null>;
/**
 * Builds a candidate transformer from candidate rows (for example the result of
 * `listProjectedCrsFromProjWasm`), so the rows can be passed to Teiresias' `estimateCrs`
 * without Atlas depending on Teiresias.
 *
 * - Points must be lon/lat degrees in lon-lat order (`{ kind: "lonlat_deg", axisOrder: "lon-lat" }`);
 *   any other geo basis gives `null`.
 * - An id that is not among `rows` gives `null`.
 * - Otherwise the result is `transformLonLatArrayToProjected(row, points)`, and what it throws
 *   (a failure on the implementation side, never an untransformable target) is passed on.
 * - The rows are copied when the transformer is created; changing them later has no effect.
 */
export declare function createCandidateTransformer(rows: ReadonlyArray<Pick<ProjectedCrsInfo, "id" | "proj4">>, options?: TransformLonLatToProjectedOptions): AtlasCandidateTransformer;
