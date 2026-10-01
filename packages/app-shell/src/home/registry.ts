import type { IconName, ToolTileSize } from '@kitbag/core-design';
import type { ToolPlugin } from '@kitbag/core-plugin-api';

export const TOOL_ID = {
  metronome: 'metronome',
  tuner: 'tuner',
  library: 'library',
  stems: 'stems',
  sync: 'sync',
} as const;

export type HomeLayout = ToolTileSize | 'row';

// The fields §9.1's ToolPlugin already carries for Home, so the §9.2 registry
// can supply this list without the screen changing. No `homeTile` means the
// tool is not built: Home shows it muted, with nothing to open.
export interface HomeToolEntry extends Pick<ToolPlugin, 'id' | 'name'> {
  readonly icon: IconName;
  readonly homeTile?: ToolPlugin['homeTile'];
  readonly layout: HomeLayout;
}

export const HOME_TOOLS: readonly HomeToolEntry[] = [
  {
    id: TOOL_ID.metronome,
    name: 'Metronome',
    icon: 'metronome',
    homeTile: { label: 'Metronome', route: '/metronome' },
    layout: '1x1',
  },
  { id: TOOL_ID.tuner, name: 'Tuner', icon: 'tuner', layout: '1x1' },
  { id: TOOL_ID.library, name: 'Songs', icon: 'songs', layout: '1x1' },
  { id: TOOL_ID.stems, name: 'Stems', icon: 'stems', layout: '1x1' },
  { id: TOOL_ID.sync, name: 'Play along', icon: 'playAlong', layout: 'row' },
];

export function continueTarget(
  lastToolId: string | undefined,
  tools: readonly HomeToolEntry[],
): HomeToolEntry | undefined {
  if (lastToolId === undefined) return undefined;
  return tools.find((t) => t.id === lastToolId && t.homeTile !== undefined);
}
