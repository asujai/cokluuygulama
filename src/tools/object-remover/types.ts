export interface Point {
  x: number;
  y: number;
}

export interface BrushStroke {
  id: string;
  points: Point[];
  brushSize: number;
}

export type BrushSizePreset = 15 | 30 | 50;

export type ViewMode = 'select' | 'mask' | 'processing' | 'result';

export type CompareMode = 'split' | 'hold' | 'side-by-side';

export type InpaintingAlgorithm = 'telea-fmm' | 'navier-stokes' | 'texture-synthesis' | 'local-onnx';

export interface LocalOnnxModelConfig {
  modelUri?: string;
  modelName?: string;
  inputResolution?: { width: number; height: number };
  isLoaded?: boolean;
  provider?: 'wasm' | 'webgl' | 'webgpu' | 'cpu' | 'nnapi' | 'coreml';
}

export interface InpaintingOptions {
  radius?: number;
  iterations?: number;
  algorithm?: InpaintingAlgorithm;
  blendEdgeRadius?: number;
  onnxConfig?: LocalOnnxModelConfig;
  onProgress?: (progress: number, stage: string) => void;
}

export interface MaskData {
  strokes: BrushStroke[];
  canvasWidth: number;
  canvasHeight: number;
  maskDataUrl?: string;
}

export interface InpaintingResult {
  cleanedImageUri: string;
  originalImageUri: string;
  width: number;
  height: number;
  processingTimeMs: number;
  algorithmUsed: string;
  historyStepsCount: number;
}

export interface SamplePhoto {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUri: string;
  width: number;
  height: number;
  demoStrokes?: BrushStroke[];
}

export interface InpaintingEngine {
  readonly name: string;
  readonly algorithm: InpaintingAlgorithm;
  isReady(): boolean;
  inpaint(
    imageUri: string,
    mask: MaskData,
    options?: InpaintingOptions
  ): Promise<InpaintingResult>;
}
