export type DuplicateGroupType = 'exact' | 'similar' | 'screenshot' | 'large';

export type FilterCategory = 'all' | 'exact' | 'similar' | 'screenshot' | 'large';

export interface PhotoItem {
  id: string;
  uri: string;
  name: string;
  size: number; // bytes
  width: number;
  height: number;
  createdAt?: number;
  ahash?: string;
  dhash?: string;
  isScreenshot?: boolean;
  isLarge?: boolean;
  selectedForDelete?: boolean;
  isBest?: boolean;
  assetId?: string | null; // MediaLibrary asset id if from device gallery
}

export interface DuplicateGroup {
  id: string;
  type: DuplicateGroupType;
  title: string;
  subtitle: string;
  similarityPercent: number;
  photos: PhotoItem[];
  bestPhotoId?: string;
  recoverableBytes: number;
}

export interface ScanStats {
  totalScanned: number;
  totalDuplicatesFound: number;
  totalSimilarFound: number;
  totalScreenshotsFound: number;
  totalLargeFound: number;
  totalRecoverableBytes: number;
  selectedRecoverableBytes: number;
  selectedCount: number;
}
