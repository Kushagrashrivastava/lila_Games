// Shapes of the static files written by pipeline/build.py.

export interface MapMeta {
  id: string;
  label: string;
  image: string;
  width: number;
  height: number;
  data: string;
  matchCount: number;
  journeyCount: number;
}

export interface DatasetIndex {
  generatedAt: string;
  maps: MapMeta[];
  dates: string[];
  eventCodes: Record<string, number>;
}

export interface MatchMeta {
  id: string;
  /** Dataset day (from the source folder), YYYY-MM-DD. */
  date: string;
  /** Match start, ISO UTC. */
  start: string;
  /** Seconds between first and last recorded event. */
  duration: number;
  humans: number;
  bots: number;
  /** Event totals indexed by event code. */
  counts: number[];
  journeys: number[];
}

/** One player (or bot) in one match: a contiguous [start, end) slice of the row columns. */
export interface Journey {
  match: number;
  user: string;
  bot: boolean;
  start: number;
  end: number;
}

export interface MapData {
  map: string;
  matches: MatchMeta[];
  journeys: Journey[];
  rows: {
    /** Seconds since match start. */
    t: number[];
    /** Minimap UV, 0–1, origin top-left. */
    u: number[];
    v: number[];
    /** Event code (see events.ts). */
    e: number[];
    /** Multiplicity: >1 when several identical events happened in the same second. */
    n: number[];
  };
}

/** MapData plus per-journey indexes built once after loading. */
export interface LoadedMap extends MapData {
  meta: MapMeta;
  image: HTMLImageElement;
  /** Row indices of movement samples, per journey. */
  moves: Int32Array[];
  /** Row indices of discrete events (kills, deaths, loot, storm), per journey. */
  events: Int32Array[];
}
