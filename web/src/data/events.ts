// Event codes must match EVENT_CODES in pipeline/config.py.
export const Ev = {
  Position: 0,
  BotPosition: 1,
  Loot: 2,
  BotKill: 3,
  BotKilled: 4,
  KilledByStorm: 5,
  Kill: 6,
  Killed: 7,
} as const;

/** What a Level Designer cares about. Several raw event types roll up into one category. */
export type Category = 'kill' | 'death' | 'storm' | 'loot';

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'kill', label: 'Kills', color: '#ef4444' },
  { id: 'death', label: 'Deaths', color: '#f1f5f9' },
  { id: 'storm', label: 'Storm deaths', color: '#c084fc' },
  { id: 'loot', label: 'Loot pickups', color: '#facc15' },
];

export const CATEGORY_COLOR: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.color]),
) as Record<Category, string>;

export const HUMAN_COLOR = '#38bdf8';
export const BOT_COLOR = '#fb923c';

export function isMovement(code: number): boolean {
  return code === Ev.Position || code === Ev.BotPosition;
}

export function categoryOf(code: number): Category | null {
  switch (code) {
    case Ev.Kill:
    case Ev.BotKill:
      return 'kill';
    case Ev.Killed:
    case Ev.BotKilled:
      return 'death';
    case Ev.KilledByStorm:
      return 'storm';
    case Ev.Loot:
      return 'loot';
    default:
      return null;
  }
}

/** Plain-language description, from the point of view of the journey's owner. */
export function describeEvent(code: number, ownerIsBot: boolean): string {
  switch (code) {
    case Ev.Kill:
      return 'Killed a player';
    case Ev.Killed:
      return 'Killed by a player';
    case Ev.BotKill:
      return ownerIsBot ? 'Bot got a kill' : 'Killed a bot';
    case Ev.BotKilled:
      return ownerIsBot ? 'Bot was killed' : 'Killed by a bot';
    case Ev.KilledByStorm:
      return 'Died to the storm';
    case Ev.Loot:
      return 'Picked up loot';
    default:
      return 'Moved';
  }
}

/** Totals per category from a match's per-code counts. */
export function categoryTotals(counts: number[]): Record<Category, number> {
  const totals: Record<Category, number> = { kill: 0, death: 0, storm: 0, loot: 0 };
  counts.forEach((n, code) => {
    const cat = categoryOf(code);
    if (cat) totals[cat] += n;
  });
  return totals;
}
