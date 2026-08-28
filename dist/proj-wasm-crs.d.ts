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
export interface ListProjectedCrsFromProjWasmOptions {
    extent: CandidateCrsExtent;
    area?: string;
    includeDeprecated?: boolean;
    onshoreOnly?: boolean;
    bboxPaddingDeg?: number;
    includeCustomProjections?: boolean;
    userProjection?: string | URL;
    /** @deprecated Use userProjection with a file://, https://, or data: URI. */
    userProjectionFile?: string;
    projWasmAssetBaseUrl?: string | URL;
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
 * m2a-t1 設計 §4 の契約:
 * - (3) 返却は常に `[easting, northing]` 順である（proj 文字列 pipeline により機構で保証する）。
 * - (4) 空入力・業務的に変換不能な target は `null`。
 * - (5) 部分成功はしない。入力または出力に非有限成分が 1 つでもあれば全体 `null`。
 * - (7) throw は実装 bug のときだけ。業務的失敗はすべて `null` へ落ちる。
 * - (8) 出力は入力と同数・同順。
 *
 * 本 export は **`lonlat_deg` / lon-lat 順の入力専用**である（設計 K3）。`planar_xy` 入力の
 * 実 engine 経路は本サイクルの範囲外である。
 */
export declare function transformLonLatArrayToProjected(target: Pick<ProjectedCrsInfo, "id" | "proj4">, points: ReadonlyArray<readonly [number, number]>, options?: TransformLonLatToProjectedOptions): Promise<Array<[number, number]> | null>;
