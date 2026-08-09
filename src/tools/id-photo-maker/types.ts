export interface PhotoPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
  aspectRatio: number; // width / height
}

export interface BgColorOption {
  id: string;
  label: string;
  color: string;
}

export interface PrintSheetOptions {
  paperSize: '4x6_inch' | 'A4';
  photosPerPage: 4 | 6 | 8;
  showCropMarks: boolean;
  backgroundColor: string;
}

export interface IdPhotoResult {
  singlePhotoUri: string;
  printSheetUri: string;
  pdfUri?: string;
  preset: PhotoPreset;
}
