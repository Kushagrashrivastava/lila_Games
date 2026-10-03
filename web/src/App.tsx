import { useEffect, useMemo, useState } from 'react';
import { categoryOf, categoryTotals, type Category } from './data/events';
import { loadIndex, loadMap } from './data/load';
import type { DatasetIndex, LoadedMap } from './data/types';
import { formatDay, formatMatchStart } from './format';
import { usePlayback } from './hooks/usePlayback';
import type { Layers } from './map/draw';
import { buildHeatmap } from './map/heatmap';
import { MapCanvas } from './map/MapCanvas';
import { FIT, fitBounds, type Viewport } from './map/viewport';
import type { HeatMode } from './ui/heatModes';
import { Legend } from './ui/Legend';
import { type MatchRow, Sidebar, type SortKey, type ViewStats } from './ui/Sidebar';
import { type Tick, Timeline } from './ui/Timeline';
import { readHash, writeHash } from './urlState';

const BASE_LAYERS: Layers = {
  humans: true,
  bots: true,
  paths: true,
  kill: true,
  death: true,
  storm: true,
  loot: false,
};
// Overview = heatmap of everything; a single match = paths you can play back.
const OVERVIEW = { paths: false, heat: 'traffic' as HeatMode };
const MATCH = { paths: true, heat: 'off' as HeatMode };

const initial = readHash();

export default function App() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [loaded, setLoaded] = useState<LoadedMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mapId, setMapId] = useState(initial.map ?? 'AmbroseValley');
  const [date, setDate] = useState(initial.date ?? 'all');
  const [matchId, setMatchId] = useState<string | null>(initial.match ?? null);
  const preset = initial.match ? MATCH : OVERVIEW;
  const [layers, setLayers] = useState<Layers>({ ...BASE_LAYERS, paths: preset.paths });
  const [heatMode, setHeatMode] = useState<HeatMode>(preset.heat);
  const [heatOpacity, setHeatOpacity] = useState(0.75);
  const [sort, setSort] = useState<SortKey>('time');

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!index) return;
    const meta = index.maps.find((m) => m.id === mapId) ?? index.maps[0];
    let cancelled = false;
    loadMap(meta)
      .then((m) => !cancelled && setLoaded(m))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [index, mapId]);

  useEffect(() => writeHash({ map: mapId, date, match: matchId ?? undefined }), [mapId, date, matchId]);

  // A pasted/edited link in an already-open tab (writeHash uses replaceState, so this doesn't loop).
  useEffect(() => {
    const onHashChange = () => {
      const s = readHash();
      const p = s.match ? MATCH : OVERVIEW;
      setMapId(s.map ?? 'AmbroseValley');
      setDate(s.date ?? 'all');
      setMatchId(s.match ?? null);
      setLayers((l) => ({ ...l, paths: p.paths }));
      setHeatMode(p.heat);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const map = loaded?.map === mapId ? loaded : null;

  const applyPreset = (p: typeof OVERVIEW) => {
    setLayers((l) => ({ ...l, paths: p.paths }));
    setHeatMode(p.heat);
  };
  const selectMatch = (id: string | null) => {
    if (id && !matchId) applyPreset(MATCH);
    if (!id && matchId) applyPreset(OVERVIEW);
    setMatchId(id);
  };
  const selectMap = (id: string) => {
    if (id === mapId) return;
    setMapId(id);
    selectMatch(null);
  };
  const selectDate = (d: string) => {
    setDate(d);
    const m = map?.matches.find((x) => x.id === matchId);
    if (m && d !== 'all' && m.date !== d) selectMatch(null);
  };

  // ---- Derived view ----
  const matchesInView = useMemo(
    () =>
      map ? map.matches.map((_, i) => i).filter((i) => date === 'all' || map.matches[i].date === date) : [],
    [map, date],
  );

  const selected = map && matchId ? map.matches.findIndex((m) => m.id === matchId) : -1;
  const selectedMatch = selected >= 0 && map ? map.matches[selected] : null;

  const journeys = useMemo(() => {
    if (!map) return [];
    const scope = selectedMatch
      ? selectedMatch.journeys
      : matchesInView.flatMap((i) => map.matches[i].journeys);
    return scope.filter((j) => (map.journeys[j].bot ? layers.bots : layers.humans));
  }, [map, selectedMatch, matchesInView, layers.humans, layers.bots]);

  const rows: MatchRow[] = useMemo(() => {
    if (!map) return [];
    const list = matchesInView.map((i) => ({
      match: map.matches[i],
      totals: categoryTotals(map.matches[i].counts),
    }));
    const by: Record<SortKey, (r: MatchRow) => number> = {
      time: (r) => -Date.parse(r.match.start),
      duration: (r) => r.match.duration,
      combat: (r) => r.totals.kill + r.totals.death + r.totals.storm,
      players: (r) => r.match.humans + r.match.bots,
    };
    return list.sort((a, b) => by[sort](b) - by[sort](a));
  }, [map, matchesInView, sort]);

  const stats: ViewStats | null = useMemo(() => {
    if (!map) return null;
    const totals: Record<Category, number> = { kill: 0, death: 0, storm: 0, loot: 0 };
    let humans = 0;
    let bots = 0;
    for (const j of journeys) {
      if (map.journeys[j].bot) bots++;
      else humans++;
      for (const i of map.events[j]) {
        const c = categoryOf(map.rows.e[i]);
        if (c) totals[c] += map.rows.n[i];
      }
    }
    return { matches: selectedMatch ? 1 : matchesInView.length, humans, bots, totals };
  }, [map, journeys, selectedMatch, matchesInView]);

  const heat = useMemo(() => {
    if (!map || heatMode === 'off') return null;
    const { u, v, e, n } = map.rows;
    return buildHeatmap((splat) => {
      for (const j of journeys) {
        if (heatMode === 'traffic') for (const i of map.moves[j]) splat(u[i], v[i], 1);
        else for (const i of map.events[j]) if (categoryOf(e[i]) === heatMode) splat(u[i], v[i], n[i]);
      }
    });
  }, [map, journeys, heatMode]);

  const fit: Viewport = useMemo(() => {
    if (!map || !selectedMatch) return FIT;
    const { u, v } = map.rows;
    let [minU, minV, maxU, maxV] = [1, 1, 0, 0];
    for (const j of selectedMatch.journeys)
      for (let i = map.journeys[j].start; i < map.journeys[j].end; i++) {
        minU = Math.min(minU, u[i]);
        maxU = Math.max(maxU, u[i]);
        minV = Math.min(minV, v[i]);
        maxV = Math.max(maxV, v[i]);
      }
    return fitBounds(minU, minV, maxU, maxV);
  }, [map, selectedMatch]);
  const fitKey = `${mapId}|${matchId ?? 'all'}|${map ? 'ready' : 'loading'}`;

  const playback = usePlayback(selectedMatch?.duration ?? 0, fitKey);

  const ticks: Tick[] = useMemo(() => {
    if (!map || !selectedMatch) return [];
    const out: Tick[] = [];
    for (const j of journeys)
      for (const i of map.events[j]) {
        const cat = categoryOf(map.rows.e[i]);
        if (cat && cat !== 'loot' && layers[cat]) out.push({ t: map.rows.t[i], cat });
      }
    return out;
  }, [map, selectedMatch, journeys, layers]);

  // Space = play/pause during match playback
  const { toggle } = playback;
  useEffect(() => {
    if (!selectedMatch) return;
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (ev.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
        ev.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedMatch, toggle]);

  if (error) {
    return (
      <div className="fullscreen-msg">
        <h1>Couldn't load the data</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  if (!index) return <div className="fullscreen-msg">Loading dataset…</div>;

  const mapLabel = index.maps.find((m) => m.id === mapId)?.label ?? mapId;

  return (
    <div className="app">
      <Sidebar
        index={index}
        mapId={mapId}
        date={date}
        matchId={selectedMatch ? matchId : null}
        layers={layers}
        heatMode={heatMode}
        heatOpacity={heatOpacity}
        sort={sort}
        rows={rows}
        stats={stats}
        onMap={selectMap}
        onDate={selectDate}
        onMatch={selectMatch}
        onLayers={setLayers}
        onHeatMode={setHeatMode}
        onHeatOpacity={setHeatOpacity}
        onSort={setSort}
      />
      <main className="stage">
        <div className="stage-head">
          <h2>
            {mapLabel}
            <span className="muted">
              {' · '}
              {selectedMatch
                ? `Match ${formatMatchStart(selectedMatch.start)} · ${selectedMatch.humans} human, ${selectedMatch.bots} bot`
                : `${date === 'all' ? 'All days' : formatDay(date)} · ${matchesInView.length} matches combined`}
            </span>
          </h2>
          {selectedMatch && (
            <button className="link" onClick={() => selectMatch(null)}>
              ← Back to all matches
            </button>
          )}
        </div>
        <div className="map-area">
          {map ? (
            <MapCanvas
              map={map}
              journeys={journeys}
              layers={layers}
              time={selectedMatch ? playback.t : null}
              heat={heat}
              heatOpacity={heatOpacity}
              fit={fit}
              fitKey={fitKey}
            />
          ) : (
            <div className="fullscreen-msg">Loading {mapLabel}…</div>
          )}
          {map && journeys.length === 0 && (
            <div className="empty">Nothing to show. Turn on Humans or Bots, or pick another day.</div>
          )}
          <Legend heatMode={heatMode} playback={!!selectedMatch} />
        </div>
        {selectedMatch && (
          <Timeline
            duration={selectedMatch.duration}
            t={playback.t}
            playing={playback.playing}
            speed={playback.speed}
            ticks={ticks}
            onToggle={playback.toggle}
            onSeek={playback.seek}
            onSpeed={playback.setSpeed}
          />
        )}
      </main>
    </div>
  );
}
