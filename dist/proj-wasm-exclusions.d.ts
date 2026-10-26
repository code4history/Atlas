export interface ProjWasmExclusionTable {
    projWasmVersion: string;
    projDbSha256: string;
    /** Rows whose WKT2:2019 export throws. They stay in the result with `wkt2: null`. */
    wkt2Unavailable: string[];
    /** Rows whose PROJ string export throws. They are left out of the result. */
    proj4Unavailable: Array<{
        id: string;
        reason: string;
    }>;
}
export declare const projWasmExclusions: ProjWasmExclusionTable;
