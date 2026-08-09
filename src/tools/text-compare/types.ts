export type DiffType = 'added' | 'deleted' | 'unchanged' | 'modified';

export interface DiffWord {
  type: DiffType;
  value: string;
}

export interface DiffLine {
  type: DiffType;
  lineA?: number;
  lineB?: number;
  textA?: string;
  textB?: string;
  text?: string;
  words?: DiffWord[];
}

export interface DiffOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  ignoreEmptyLines: boolean;
  granularity: 'line' | 'word';
  viewMode: 'inline' | 'sideBySide';
}

export interface DiffSummary {
  addedLines: number;
  deletedLines: number;
  modifiedLines: number;
  unchangedLines: number;
  totalLinesA: number;
  totalLinesB: number;
  similarityRatio: number;
}
