import { BOT_COLOR, CATEGORY_COLOR, type Category, categoryOf, HUMAN_COLOR } from '../data/events';
import type { LoadedMap } from '../data/types';
import { type Frame, uvToScreen, type Viewport } from './viewport';

export interface Layers {
  humans: boolean;
  bots: boolean;
  paths: boolean;
  kill: boolean;
  death: boolean;
  storm: boolean;
  loot: boolean;
}

export interface Scene {
  map: LoadedMap;
  vp: Viewport;
  frame: Frame;
  journeys: number[];
  layers: Layers;
  /** Seconds since match start during playback; null = show everything (aggregate view). */
  time: number | null;
  heat: HTMLCanvasElement | null;
  heatOpacity: number;
}

/** A drawn marker, kept for hover hit-testing. */
export interface Hit {
  x: number;
  y: number;
  row: number;
  journey: number;
}

const OUTLINE = 'rgba(8, 11, 16, 0.9)';
const PULSE_SECONDS = 4;

/** Index of the last movement sample at or before t (−1 if none). */
function lastSampleAt(map: LoadedMap, moves: Int32Array, t: number): number {
  const ts = map.rows.t;
  let lo = 0;
  let hi = moves.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts[moves[mid]] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Interpolated UV of a journey at time t, or null before its first sample. */
export function positionAt(map: LoadedMap, j: number, t: number): [number, number] | null {
  const moves = map.moves[j];
  const k = lastSampleAt(map, moves, t);
  if (k < 0) return null;
  const { u, v, t: ts } = map.rows;
  const a = moves[k];
  if (k === moves.length - 1) return [u[a], v[a]];
  const b = moves[k + 1];
  const f = (t - ts[a]) / Math.max(1, ts[b] - ts[a]);
  return [u[a] + (u[b] - u[a]) * f, v[a] + (v[b] - v[a]) * f];
}

function tracePath(ctx: CanvasRenderingContext2D, s: Scene, j: number, until: number | null): number {
  const { u, v, t } = s.map.rows;
  const moves = s.map.moves[j];
  let drawn = 0;
  ctx.beginPath();
  for (const i of moves) {
    if (until !== null && t[i] > until) break;
    const [x, y] = uvToScreen(s.vp, s.frame, u[i], v[i]);
    if (drawn++ === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (until !== null && drawn > 0) {
    const p = positionAt(s.map, j, until);
    if (p) ctx.lineTo(...uvToScreen(s.vp, s.frame, p[0], p[1]));
  }
  return drawn;
}

export function drawMarker(
  ctx: CanvasRenderingContext2D,
  cat: Category,
  x: number,
  y: number,
  size = 1,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.lineCap = 'round';
  const color = CATEGORY_COLOR[cat];
  switch (cat) {
    case 'kill': // crosshair
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -3);
      ctx.moveTo(0, 3);
      ctx.lineTo(0, 8);
      ctx.moveTo(-8, 0);
      ctx.lineTo(-3, 0);
      ctx.moveTo(3, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      break;
    case 'death': // X
      for (const [stroke, width] of [
        [OUTLINE, 5],
        [color, 2.2],
      ] as const) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(-4.5, -4.5);
        ctx.lineTo(4.5, 4.5);
        ctx.moveTo(-4.5, 4.5);
        ctx.lineTo(4.5, -4.5);
        ctx.stroke();
      }
      break;
    case 'storm': // diamond
      ctx.fillStyle = color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'loot': // small dot
      ctx.fillStyle = color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene): Hit[] {
  const { map, vp, frame, layers, time } = s;
  ctx.clearRect(0, 0, frame.w, frame.h);

  // Minimap
  const [x0, y0] = uvToScreen(vp, frame, 0, 0);
  const [x1, y1] = uvToScreen(vp, frame, 1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(map.image, x0, y0, x1 - x0, y1 - y0);

  // Heatmap
  if (s.heat) {
    ctx.save();
    ctx.globalAlpha = s.heatOpacity;
    ctx.drawImage(s.heat, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  const playback = time !== null;

  // Paths
  if (layers.paths) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const j of s.journeys) {
      const bot = map.journeys[j].bot;
      ctx.strokeStyle = bot ? BOT_COLOR : HUMAN_COLOR;
      ctx.setLineDash(bot && playback ? [5, 4] : []);
      if (playback) {
        ctx.globalAlpha = 0.3; // ghost of the full route
        ctx.lineWidth = 1.5;
        tracePath(ctx, s, j, null);
        ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 2.5;
        if (tracePath(ctx, s, j, time) > 0) ctx.stroke();
      } else {
        ctx.globalAlpha = bot ? 0.28 : 0.32;
        ctx.lineWidth = 1.1;
        tracePath(ctx, s, j, null);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Event markers. Loot first so combat markers sit on top.
  const hits: Hit[] = [];
  const { u, v, t, e } = map.rows;
  for (const pass of ['loot', 'kill', 'death', 'storm'] as Category[]) {
    if (!layers[pass]) continue;
    for (const j of s.journeys) {
      const bot = map.journeys[j].bot;
      for (const i of map.events[j]) {
        if (categoryOf(e[i]) !== pass) continue;
        if (playback && t[i] > time) continue;
        const [x, y] = uvToScreen(vp, frame, u[i], v[i]);
        if (x < -10 || y < -10 || x > frame.w + 10 || y > frame.h + 10) continue;
        if (playback && time - t[i] < PULSE_SECONDS) {
          const k = (time - t[i]) / PULSE_SECONDS;
          ctx.strokeStyle = CATEGORY_COLOR[pass];
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 8 + k * 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const size = (playback ? 1 : 0.62) * (bot ? 0.8 : 1);
        drawMarker(ctx, pass, x, y, size, bot ? 0.85 : 1);
        hits.push({ x, y, row: i, journey: j });
      }
    }
  }

  // Player heads during playback
  if (playback) {
    for (const j of s.journeys) {
      const p = positionAt(map, j, time);
      if (!p) continue;
      const moves = map.moves[j];
      const finished = time > t[moves[moves.length - 1]];
      const [x, y] = uvToScreen(vp, frame, p[0], p[1]);
      ctx.globalAlpha = finished ? 0.45 : 1;
      ctx.fillStyle = map.journeys[j].bot ? BOT_COLOR : HUMAN_COLOR;
      ctx.strokeStyle = '#0b0f14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (map.journeys[j].bot) ctx.rect(x - 4.5, y - 4.5, 9, 9);
      else ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  return hits;
}
