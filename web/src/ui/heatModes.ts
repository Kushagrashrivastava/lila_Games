import type { Category } from '../data/events';

export type HeatMode = 'off' | 'traffic' | Category;

export const HEAT_MODES: { id: HeatMode; label: string; description: string }[] = [
  { id: 'off', label: 'Off', description: '' },
  { id: 'traffic', label: 'Traffic', description: 'Where players spend time' },
  { id: 'kill', label: 'Kills', description: 'Where kills happen' },
  { id: 'death', label: 'Deaths', description: 'Where players die (combat)' },
  { id: 'storm', label: 'Storm', description: 'Where the storm catches players' },
  { id: 'loot', label: 'Loot', description: 'Where loot is picked up' },
];
