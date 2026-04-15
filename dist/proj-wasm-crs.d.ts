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
    userProjectionFile?: string;
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
export declare function listProjectedCrsFromProjWasm(options: ListProjectedCrsFromProjWasmOptions): Promise<ProjectedCrsInfo[]>;
