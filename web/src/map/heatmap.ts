// Density heatmap: bin weighted UV points into a grid, Gaussian-blur it, colorize into a small canvas
// that the map renderer stretches over the minimap.

const GRID = 256;
const SIGMA = 2.2; // in grid cells (~0.9% of the map)

// Transparent → violet → magenta → orange → yellow. Alpha ramps up so empty areas show the map.
const STOPS: [number, [number, number, number, number]][] = [
  [0, [0, 0, 0, 0]],
  [0.08, [76, 29, 149, 90]],
  [0.3, [192, 38, 211, 170]],
  [0.6, [249, 115, 22, 215]],
  [1, [254, 240, 138, 245]],
];

const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s = 0;
    while (s < STOPS.length - 2 && t > STOPS[s + 1][0]) s++;
    const [t0, c0] = STOPS[s];
    const [t1, c1] = STOPS[s + 1];
    const k = (t - t0) / (t1 - t0);
    for (let c = 0; c < 4; c++) lut[i * 4 + c] = c0[c] + (c1[c] - c0[c]) * k;
  }
  return lut;
})();

function kernel(sigma: number): Float32Array {
  const r = Math.ceil(sigma * 3);
  const k = new Float32Array(r * 2 + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma));
  return k.map((x) => x / sum);
}
const KERNEL = kernel(SIGMA);

function blur(src: Float32Array): Float32Array {
  const r = (KERNEL.length - 1) / 2;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < GRID) acc += src[y * GRID + xx] * KERNEL[i + r];
      }
      tmp[y * GRID + x] = acc;
    }
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < GRID) acc += tmp[yy * GRID + x] * KERNEL[i + r];
      }
      out[y * GRID + x] = acc;
    }
  return out;
}

export type Splat = (u: number, v: number, weight: number) => void;

/** Returns a GRID×GRID canvas, or null when there is nothing to show. */
export function buildHeatmap(collect: (splat: Splat) => void): HTMLCanvasElement | null {
  const grid = new Float32Array(GRID * GRID);
  let total = 0;
  collect((u, v, w) => {
    const x = Math.floor(u * GRID);
    const y = Math.floor(v * GRID);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    grid[y * GRID + x] += w;
    total += w;
  });
  if (total === 0) return null;

  const density = blur(grid);
  let max = 0;
  for (const d of density) if (d > max) max = d;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(GRID, GRID);
  for (let i = 0; i < density.length; i++) {
    // sqrt compresses the range so a single hotspot doesn't wash out everything else
    const level = Math.round(Math.sqrt(density[i] / max) * 255);
    img.data.set(LUT.subarray(level * 4, level * 4 + 4), i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
