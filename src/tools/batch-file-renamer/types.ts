export type RenameMode = 'pattern' | 'find_replace' | 'casing';
export type CasingOption = 'preserve' | 'lowercase' | 'uppercase' | 'titlecase';

export interface FileItem {
  id: string;
  originalName: string;
  newName: string;
  size: number;
  uri: string;
  mimeType?: string;
  status?: 'pending' | 'renamed' | 'error';
}

export interface RenameConfig {
  mode: RenameMode;
  prefix: string;
  suffix: string;
  baseName: string; // If empty, keeps original base name
  useNumbering: boolean;
  startNumber: number;
  numberPadding: number; // e.g. 2 -> '01', 3 -> '001'
  numberPosition: 'prefix' | 'suffix' | 'replace';
  findText: string;
  replaceText: string;
  casing: CasingOption;
  extensionCasing: 'preserve' | 'lowercase' | 'uppercase';
}

export interface BatchRenameResult {
  renamedFiles: { originalName: string; newName: string; uri: string }[];
  successCount: number;
  failureCount: number;
  scriptContentBat: string;
  scriptContentSh: string;
}
