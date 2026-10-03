// Keep map/day/match in the URL hash so a view can be shared as a link.

export interface UrlState {
  map?: string;
  date?: string;
  match?: string;
}

export function readHash(): UrlState {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    map: params.get('map') ?? undefined,
    date: params.get('day') ?? undefined,
    match: params.get('match') ?? undefined,
  };
}

export function writeHash(state: UrlState): void {
  const params = new URLSearchParams();
  if (state.map) params.set('map', state.map);
  if (state.date && state.date !== 'all') params.set('day', state.date);
  if (state.match) params.set('match', state.match);
  const hash = params.toString();
  window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
}
