export function zoomToScale(zoom: number): number {
  const scale = 1 + Math.max(0, Math.min(1, zoom)) * 9;
  return Math.round(scale * 10) / 10;
}

export function scaleToZoom(scale: number): number {
  const clamped = Math.max(1, Math.min(10, scale));
  return (clamped - 1) / 9;
}

export function formatZoomLabel(zoom: number): string {
  const scale = zoomToScale(zoom);
  return `${scale.toFixed(1)}x`;
}
