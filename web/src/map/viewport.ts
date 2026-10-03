// Minimap UV (0–1, origin top-left, produced by pipeline/coords.py) ↔ screen pixels.
// The single source of truth for coordinate math in the browser.

export interface Viewport {
  /** UV at the center of the screen. */
  cx: number;
  cy: number;
  /** 1 = whole map fits the canvas. */
  zoom: number;
}

export interface Frame {
  /** Canvas size in CSS pixels. */
  w: number;
  h: number;
  /** Minimap height / width (images are ~square, GrandRift is 2160×2158). */
  aspect: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 24;
export const FIT: Viewport = { cx: 0.5, cy: 0.5, zoom: 1 };

/** Screen pixels per UV unit horizontally. */
export function pxPerUv(vp: Viewport, f: Frame): number {
  return vp.zoom * Math.min(f.w, f.h / f.aspect) * 0.96;
}

export function uvToScreen(vp: Viewport, f: Frame, u: number, v: number): [number, number] {
  const k = pxPerUv(vp, f);
  return [(u - vp.cx) * k + f.w / 2, (v - vp.cy) * k * f.aspect + f.h / 2];
}

export function screenToUv(vp: Viewport, f: Frame, x: number, y: number): [number, number] {
  const k = pxPerUv(vp, f);
  return [(x - f.w / 2) / k + vp.cx, (y - f.h / 2) / (k * f.aspect) + vp.cy];
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom by `factor`, keeping the UV point under (sx, sy) fixed on screen. */
export function zoomAt(vp: Viewport, f: Frame, sx: number, sy: number, factor: number): Viewport {
  const [u, v] = screenToUv(vp, f, sx, sy);
  const next = { ...vp, zoom: clampZoom(vp.zoom * factor) };
  const [u2, v2] = screenToUv(next, f, sx, sy);
  return { ...next, cx: next.cx + (u - u2), cy: next.cy + (v - v2) };
}

export function pan(vp: Viewport, f: Frame, dx: number, dy: number): Viewport {
  const k = pxPerUv(vp, f);
  return { ...vp, cx: vp.cx - dx / k, cy: vp.cy - dy / (k * f.aspect) };
}

/** Viewport that frames a UV bounding box with some padding. */
export function fitBounds(minU: number, minV: number, maxU: number, maxV: number): Viewport {
  const span = Math.max(maxU - minU, maxV - minV, 0.08) * 1.35;
  return { cx: (minU + maxU) / 2, cy: (minV + maxV) / 2, zoom: clampZoom(1 / span) };
}
