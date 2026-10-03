import { isMovement } from './events';
import type { DatasetIndex, LoadedMap, MapData, MapMeta } from './types';

const base = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load minimap ${src}`));
    img.src = src;
  });
}

export function loadIndex(): Promise<DatasetIndex> {
  return fetchJson<DatasetIndex>('data/index.json');
}

const cache = new Map<string, Promise<LoadedMap>>();

/** Load a map's data + minimap once; later calls reuse the same promise. */
export function loadMap(meta: MapMeta): Promise<LoadedMap> {
  let p = cache.get(meta.id);
  if (!p) {
    p = Promise.all([fetchJson<MapData>(meta.data), loadImage(base + meta.image)]).then(([data, image]) =>
      index(data, meta, image),
    );
    p.catch(() => cache.delete(meta.id));
    cache.set(meta.id, p);
  }
  return p;
}

function index(data: MapData, meta: MapMeta, image: HTMLImageElement): LoadedMap {
  const { e } = data.rows;
  const moves: Int32Array[] = [];
  const events: Int32Array[] = [];
  for (const j of data.journeys) {
    const m: number[] = [];
    const ev: number[] = [];
    for (let i = j.start; i < j.end; i++) (isMovement(e[i]) ? m : ev).push(i);
    moves.push(Int32Array.from(m));
    events.push(Int32Array.from(ev));
  }
  return { ...data, meta, image, moves, events };
}
