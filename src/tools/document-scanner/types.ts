export type FilterType = 'original' | 'grayscale' | 'contrast' | 'document';

export interface ScannedPage {
  id: string;
  originalUri: string;
  processedUri: string;
  rotation: number; // 0, 90, 180, 270
  filter: FilterType;
  width?: number;
  height?: number;
  ocrText?: string;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0 to 1
}

export interface FilterOption {
  id: FilterType;
  label: string;
  icon: string;
  description: string;
}
