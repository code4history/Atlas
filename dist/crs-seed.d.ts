export type CandidateDatumFamily = "wgs84" | "tokyo" | "jgd2000" | "jgd2011" | "jgd2024";
export type CandidateKind = "web_mercator" | "utm" | "japan_plane_rectangular" | "japan_land_area" | "regional_map" | "weather_map";
export type CandidateSeedScope = "core" | "all";
export interface CandidateAuthorityId {
    authority: string;
    code: string;
}
export interface CandidateBbox {
    west: number;
    south: number;
    east: number;
    north: number;
}
export declare function isProjectedPrjPath(pathname: string): boolean;
export declare function inferDatumFamily(pathname: string): CandidateDatumFamily;
export declare function inferKind(pathname: string): CandidateKind;
export declare function isScopeIncluded(kind: CandidateKind, scope: CandidateSeedScope): boolean;
export declare function inferWgsEquivalent(datumFamily: CandidateDatumFamily): boolean;
export declare function extractAuthorityIdFromWkt(wkt: string): CandidateAuthorityId | undefined;
export declare function extractWktName(wkt: string): string;
export declare function inferPriority(kind: CandidateKind): number;
export declare function inferApproximateBbox(pathname: string, kind: CandidateKind): CandidateBbox;
export declare function bboxToPolygonWkt(bbox: CandidateBbox): string;
