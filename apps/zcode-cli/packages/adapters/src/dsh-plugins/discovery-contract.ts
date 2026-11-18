export type DshData = null | boolean | number | string | DshData[] | { [key: string]: DshData };
export type DshPackageSource =
  | { kind: "npm"; spec: string; packageName: string }
  | { kind: "github"; spec: string; repository: string; ref?: string }
  | { kind: "https"; spec: string; integrity?: string }
  | { kind: "directory"; spec: string; path: string };

export interface DshCatalogEntry {
  id: string;
  name: string;
  packageName?: string;
  source: DshPackageSource;
  description?: string;
  descriptionI18n?: Record<string, string>;
  version?: string;
  author?: string;
  license?: string;
  repository?: string;
  icon?: string;
  category?: string;
  capabilities: string[];
  compatibility: "unverified";
}

export interface DshCatalog {
  id: string;
  name: string;
  url: string;
  entries: DshCatalogEntry[];
  diagnostics: Array<{ index: number; message: string }>;
}
