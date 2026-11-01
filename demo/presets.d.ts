export interface PresetExtent {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface PresetInput {
  extent: PresetExtent;
  areaFilterEnabled: boolean;
  areaMode: string;
  includeCustomProjections: boolean;
  onshoreOnly: boolean;
  includeDeprecated: boolean;
}

export interface PresetOption {
  id: string;
  label: string;
  expectation: string;
  input: PresetInput;
}

export interface PresetContrast {
  id: string;
  title: string;
  options: PresetOption[];
}

export interface LookupOptions {
  extent: PresetExtent;
  area?: string;
  includeDeprecated: boolean;
  onshoreOnly: boolean;
  includeCustomProjections: boolean;
}

export const AREA_BY_MODE: Readonly<Record<string, string>>;
export const NEUTRAL_EXPECTATION: string;
export const PRESETS: readonly PresetContrast[];
export function findPreset(presetId: string, optionId: string): PresetOption | undefined;
export function buildLookupOptions(input: PresetInput, options?: { autoArea?: string }): LookupOptions;
