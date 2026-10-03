import { BOT_COLOR, CATEGORIES, type Category, CATEGORY_COLOR, HUMAN_COLOR } from '../data/events';
import type { DatasetIndex, MatchMeta } from '../data/types';
import { formatClock, formatDay, formatTime } from '../format';
import type { Layers } from '../map/draw';
import { HEAT_MODES, type HeatMode } from './heatModes';
import { MarkerIcon } from './Legend';

export type SortKey = 'time' | 'duration' | 'combat' | 'players';

export interface MatchRow {
  match: MatchMeta;
  totals: Record<Category, number>;
}

export interface ViewStats {
  matches: number;
  humans: number;
  bots: number;
  totals: Record<Category, number>;
}

interface Props {
  index: DatasetIndex;
  mapId: string;
  date: string;
  matchId: string | null;
  layers: Layers;
  heatMode: HeatMode;
  heatOpacity: number;
  sort: SortKey;
  rows: MatchRow[];
  stats: ViewStats | null;
  onMap: (id: string) => void;
  onDate: (d: string) => void;
  onMatch: (id: string | null) => void;
  onLayers: (l: Layers) => void;
  onHeatMode: (m: HeatMode) => void;
  onHeatOpacity: (o: number) => void;
  onSort: (s: SortKey) => void;
}

const LAST_DAY_PARTIAL = true; // README: February 14 is a partial day

export function Sidebar(p: Props) {
  const lastDate = p.index.dates[p.index.dates.length - 1];
  const toggle = (key: keyof Layers) => p.onLayers({ ...p.layers, [key]: !p.layers[key] });

  return (
    <aside className="sidebar">
      <header className="brand">
        <h1>Player Journeys</h1>
        <p>LILA BLACK · level design telemetry</p>
      </header>

      <section>
        <h2>Map</h2>
        <div className="segmented">
          {p.index.maps.map((m) => (
            <button key={m.id} className={m.id === p.mapId ? 'on' : ''} onClick={() => p.onMap(m.id)}>
              {m.label}
              <small>{m.matchCount} matches</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Day</h2>
        <div className="chips">
          <button className={p.date === 'all' ? 'on' : ''} onClick={() => p.onDate('all')}>
            All 5 days
          </button>
          {p.index.dates.map((d) => (
            <button key={d} className={d === p.date ? 'on' : ''} onClick={() => p.onDate(d)}>
              {formatDay(d)}
              {LAST_DAY_PARTIAL && d === lastDate && <small> (partial)</small>}
            </button>
          ))}
        </div>
      </section>

      {p.stats && (
        <section className="stats" aria-label="Totals for the current selection">
          <Stat label="Matches" value={p.stats.matches} />
          <Stat label="Humans" value={p.stats.humans} color={HUMAN_COLOR} />
          <Stat label="Bots" value={p.stats.bots} color={BOT_COLOR} />
          {CATEGORIES.map((c) => (
            <Stat key={c.id} label={c.label} value={p.stats!.totals[c.id]} color={c.color} />
          ))}
        </section>
      )}

      <section>
        <h2>Show</h2>
        <div className="toggles">
          <Toggle on={p.layers.humans} onClick={() => toggle('humans')}>
            <span className="dot" style={{ background: HUMAN_COLOR }} /> Humans
          </Toggle>
          <Toggle on={p.layers.bots} onClick={() => toggle('bots')}>
            <span className="dot square" style={{ background: BOT_COLOR }} /> Bots
          </Toggle>
          <Toggle on={p.layers.paths} onClick={() => toggle('paths')}>
            <span className="swatch-line" style={{ background: HUMAN_COLOR }} /> Paths
          </Toggle>
          {CATEGORIES.map((c) => (
            <Toggle key={c.id} on={p.layers[c.id]} onClick={() => toggle(c.id)}>
              <MarkerIcon cat={c.id} /> {c.label}
            </Toggle>
          ))}
        </div>
      </section>

      <section>
        <h2>Heatmap</h2>
        <div className="segmented small">
          {HEAT_MODES.map((m) => (
            <button key={m.id} className={m.id === p.heatMode ? 'on' : ''} onClick={() => p.onHeatMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {p.heatMode !== 'off' && (
          <label className="slider">
            Opacity
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={p.heatOpacity}
              onChange={(ev) => p.onHeatOpacity(Number(ev.target.value))}
            />
          </label>
        )}
      </section>

      <section className="matches">
        <div className="matches-head">
          <h2>Matches ({p.rows.length})</h2>
          <select
            value={p.sort}
            onChange={(ev) => p.onSort(ev.target.value as SortKey)}
            aria-label="Sort matches"
          >
            <option value="time">By time</option>
            <option value="duration">Longest</option>
            <option value="combat">Most combat</option>
            <option value="players">Most players</option>
          </select>
        </div>
        <button className={`match-row all ${p.matchId === null ? 'on' : ''}`} onClick={() => p.onMatch(null)}>
          <strong>All matches combined</strong>
          <small>Heatmaps and markers across every match in view</small>
        </button>
        <div className="match-list">
          {p.rows.map(({ match, totals }) => (
            <button
              key={match.id}
              className={`match-row ${match.id === p.matchId ? 'on' : ''}`}
              onClick={() => p.onMatch(match.id)}
            >
              <span className="row1">
                <span>
                  {p.date === 'all' && `${formatDay(match.start.slice(0, 10))} · `}
                  {formatTime(match.start)}
                </span>
                <span className="muted">{formatClock(match.duration)}</span>
              </span>
              <span className="row2">
                <Count color={HUMAN_COLOR} n={match.humans} label="humans" />
                <Count color={BOT_COLOR} n={match.bots} label="bots" square />
                <Count color={CATEGORY_COLOR.kill} n={totals.kill} label="kills" glyph="⊕" />
                <Count color={CATEGORY_COLOR.death} n={totals.death} label="deaths" glyph="✕" />
                <Count color={CATEGORY_COLOR.storm} n={totals.storm} label="storm deaths" glyph="◆" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <footer className="about">
        5 days of production telemetry (10–14 Feb 2026). Most matches contain only a sample of their players,
        so a single match may show one person's run.
      </footer>
    </aside>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat">
      <span className="stat-value" style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Count(props: { color: string; n: number; label: string; glyph?: string; square?: boolean }) {
  if (props.n === 0 && props.glyph) return null;
  return (
    <span className="count" title={`${props.n} ${props.label}`}>
      {props.glyph ? (
        <span style={{ color: props.color }}>{props.glyph}</span>
      ) : (
        <span className={`dot ${props.square ? 'square' : ''}`} style={{ background: props.color }} />
      )}
      {props.n}
    </span>
  );
}
