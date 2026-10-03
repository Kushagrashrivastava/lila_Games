import { useEffect, useRef } from 'react';
import { BOT_COLOR, CATEGORIES, type Category, HUMAN_COLOR } from '../data/events';
import { drawMarker } from '../map/draw';
import type { HeatMode } from './heatModes';
import { HEAT_MODES } from './heatModes';

/** Renders the exact same marker the map draws, so the legend can't drift from the map. */
export function MarkerIcon({ cat }: { cat: Category }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = 18 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMarker(ctx, cat, 9, 9);
  }, [cat]);
  return <canvas ref={ref} className="marker-icon" style={{ width: 18, height: 18 }} aria-hidden />;
}

export function Legend({ heatMode, playback }: { heatMode: HeatMode; playback: boolean }) {
  const heat = HEAT_MODES.find((m) => m.id === heatMode);
  return (
    <div className="legend">
      <div className="legend-row">
        <span className="swatch-line" style={{ background: HUMAN_COLOR }} /> Human
        <span className="swatch-line dashed" style={{ color: BOT_COLOR }} /> Bot
        {playback && <span className="muted">● human · ■ bot = current position</span>}
      </div>
      <div className="legend-row">
        {CATEGORIES.map((c) => (
          <span key={c.id} className="legend-item">
            <MarkerIcon cat={c.id} /> {c.label}
          </span>
        ))}
      </div>
      {heat && heat.id !== 'off' && (
        <div className="legend-row">
          <span className="muted">{heat.description}:</span> low
          <span className="heat-bar" /> high
        </div>
      )}
    </div>
  );
}
