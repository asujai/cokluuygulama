export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  latitudeRef?: string;
  longitudeRef?: string;
  altitudeRef?: number;
  mapUrl: string;
  osmUrl: string;
}

export interface ExifMetadata {
  // Device & Camera
  make?: string;
  model?: string;
  software?: string;
  hostComputer?: string;

  // Lens & Capture Details
  lensMake?: string;
  lensModel?: string;
  focalLength?: string;
  focalLength35mm?: string;
  fNumber?: string;
  exposureTime?: string;
  isoSpeedRatings?: number;
  exposureProgram?: string;
  meteringMode?: string;
  flash?: string;
  whiteBalance?: string;

  // Timestamp
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  modifyDate?: string;

  // Technical
  imageWidth?: number;
  imageHeight?: number;
  colorSpace?: string;
  orientation?: number;

  // Location / GPS
  gps?: GpsCoordinates;

  // Status
  hasSensitiveData: boolean;
  totalTagsCount: number;
}

export interface CleanedPhotoResult {
  originalUri: string;
  cleanedUri: string;
  fileName: string;
  originalSize: number;
  cleanedSize: number;
  removedTagsCount: number;
  removedGps: boolean;
}
