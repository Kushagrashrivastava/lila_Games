import { CATEGORY_COLOR, type Category } from '../data/events';
import { formatClock } from '../format';
import { SPEEDS } from '../hooks/usePlayback';

export interface Tick {
  t: number;
  cat: Category;
}

interface Props {
  duration: number;
  t: number;
  playing: boolean;
  speed: number;
  ticks: Tick[];
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
}

export function Timeline({ duration, t, playing, speed, ticks, onToggle, onSeek, onSpeed }: Props) {
  const pct = (x: number) => `${(duration > 0 ? x / duration : 0) * 100}%`;
  return (
    <div className="timeline">
      <button className="play" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} title="Space">
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="clock">
        {formatClock(t)} <span className="muted">/ {formatClock(duration)}</span>
      </span>
      <div className="track">
        <div className="ticks" aria-hidden>
          {ticks.map((tick, i) => (
            <span
              key={i}
              className={`tick tick-${tick.cat}`}
              style={{ left: pct(tick.t), background: CATEGORY_COLOR[tick.cat] }}
            />
          ))}
        </div>
        <div className="progress" style={{ width: pct(t) }} />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={t}
          onChange={(ev) => onSeek(Number(ev.target.value))}
          aria-label="Match time"
        />
      </div>
      <select value={speed} onChange={(ev) => onSpeed(Number(ev.target.value))} aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>
    </div>
  );
}
