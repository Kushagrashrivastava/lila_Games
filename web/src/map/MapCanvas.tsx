import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeEvent } from '../data/events';
import type { LoadedMap } from '../data/types';
import { formatClock, formatMatchStart } from '../format';
import { drawScene, type Hit, type Layers } from './draw';
import { FIT, type Frame, pan, type Viewport, zoomAt } from './viewport';

interface Props {
  map: LoadedMap;
  journeys: number[];
  layers: Layers;
  time: number | null;
  heat: HTMLCanvasElement | null;
  heatOpacity: number;
  /** Viewport to jump to whenever `fitKey` changes (e.g. framing a selected match). */
  fit: Viewport;
  fitKey: string;
}

interface Tooltip {
  x: number;
  y: number;
  hit: Hit;
}

const HOVER_RADIUS = 10;

export function MapCanvas({ map, journeys, layers, time, heat, heatOpacity, fit, fitKey }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<Hit[]>([]);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [vp, setVp] = useState<Viewport>(fit);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [lastFitKey, setLastFitKey] = useState(fitKey);

  // Re-frame when the selection changes (adjusting state during render, per React docs).
  if (fitKey !== lastFitKey) {
    setLastFitKey(fitKey);
    setVp(fit);
    setTooltip(null);
  }

  const frame: Frame = { w: size.w, h: size.h, aspect: map.meta.height / map.meta.width };

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Measure now: ResizeObserver only reports on the next rendered frame, which would leave the
    // canvas at 0×0 (blank) after every map switch until then.
    const r = el.getBoundingClientRect();
    setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw before the browser paints (resizing a canvas clears it, so a passive effect could flash a blank frame)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hitsRef.current = drawScene(ctx, {
      map,
      vp,
      frame: { w: size.w, h: size.h, aspect: map.meta.height / map.meta.width },
      journeys,
      layers,
      time,
      heat,
      heatOpacity,
    });
  }, [map, vp, size, journeys, layers, time, heat, heatOpacity]);

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  const frameRef = useRef(frame);
  useLayoutEffect(() => {
    frameRef.current = frame;
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = canvas.getBoundingClientRect();
      const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
      setVp((p) => zoomAt(p, frameRef.current, ev.clientX - r.left, ev.clientY - r.top, factor));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const findHit = useCallback((x: number, y: number): Hit | null => {
    let best: Hit | null = null;
    let bestD = HOVER_RADIUS * HOVER_RADIUS;
    for (const h of hitsRef.current) {
      const d = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }, []);

  const local = (ev: React.PointerEvent) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    dragRef.current = local(ev);
    setTooltip(null);
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(ev);
    if (dragRef.current) {
      const dx = p.x - dragRef.current.x;
      const dy = p.y - dragRef.current.y;
      dragRef.current = p;
      setVp((prev) => pan(prev, frame, dx, dy));
      return;
    }
    const hit = findHit(p.x, p.y);
    setTooltip(hit ? { x: p.x, y: p.y, hit } : null);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const zoomBy = (factor: number) => setVp((p) => zoomAt(p, frame, frame.w / 2, frame.h / 2, factor));

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setTooltip(null)}
        onDoubleClick={() => setVp(fit)}
        aria-label={`${map.meta.label} minimap with player journeys`}
        role="img"
      />
      <div className="zoom-controls">
        <button onClick={() => zoomBy(1.5)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => setVp(FIT)} aria-label="Show whole map" title="Show whole map">
          ⤢
        </button>
      </div>
      {tooltip && <TooltipView map={map} tooltip={tooltip} playback={time !== null} />}
    </div>
  );
}

function TooltipView({ map, tooltip, playback }: { map: LoadedMap; tooltip: Tooltip; playback: boolean }) {
  const { hit } = tooltip;
  const journey = map.journeys[hit.journey];
  const match = map.matches[journey.match];
  const n = map.rows.n[hit.row];
  return (
    <div className="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
      <strong>
        {describeEvent(map.rows.e[hit.row], journey.bot)}
        {n > 1 && ` ×${n}`}
      </strong>
      <span>
        {journey.bot ? 'Bot' : 'Human'} · {journey.user.slice(0, 8)}
      </span>
      <span>
        {formatClock(map.rows.t[hit.row])} into the match
        {!playback && ` · ${formatMatchStart(match.start)}`}
      </span>
    </div>
  );
}
