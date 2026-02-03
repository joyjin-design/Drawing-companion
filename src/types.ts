export type CompareMode = "overlay" | "slider";

export type OverlaySettings = {
  opacity: number;
  scale: number;
  rotation: number;
  translateX: number;
  translateY: number;
};

export type Guides = {
  grid: boolean;
  centerline: boolean;
};

export type Session = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  referenceImageId: string;
  drawingImageId: string;
  compareMode: CompareMode;
  overlaySettings: OverlaySettings;
  guides: Guides;
};

export type ImageRecord = {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  type: "reference" | "drawing";
};
