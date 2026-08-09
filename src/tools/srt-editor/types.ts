export interface SrtCue {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export type ShiftTargetMode = 'all' | 'from_selected';

export interface SrtFilterOptions {
  searchQuery: string;
}
