import type { IconName, ToolStatus, ToolTileSize } from '@kitbag/core-design';
import type { HomeTileDescriptor, ToolPlugin } from '@kitbag/core-plugin-api';
import { PLAY_ALONG_NAME } from '@kitbag/tool-sync';

import { TOOL_ID, TOOL_ROUTES } from './toolRoutes.ts';

export { TOOL_ID };

export type HomeLayout = ToolTileSize | 'row';

export type ToolOnTest = (toolId: string) => boolean;

// Paths only: expo-router mounts each screen from its file under src/app/.
export type ToolRoute = Pick<ToolPlugin['routes'][number], 'path'>;

// The fields §9.1's ToolPlugin already carries for Home, so the §9.2 registry
// can supply this list without the screen changing. No `homeTile` means the
// tool is not built: Home shows it muted, with nothing to open.
export interface HomeToolEntry extends Pick<ToolPlugin, 'id' | 'name'> {
  readonly routes: readonly ToolRoute[];
  readonly icon: IconName;
  readonly homeTile?: ToolPlugin['homeTile'];
  readonly layout: HomeLayout;
  readonly summary?: string;
  readonly shortcut?: boolean;
}

const CORE_SUMMARY = 'Core';

const routesOf = (
  group: Readonly<Record<string, string>>,
): readonly ToolRoute[] => Object.values(group).map((path) => ({ path }));

export const HOME_TOOLS: readonly HomeToolEntry[] = [
  {
    id: TOOL_ID.metronome,
    name: 'Metronome',
    icon: 'metronome',
    routes: routesOf(TOOL_ROUTES.metronome),
    homeTile: { label: 'Metronome', route: TOOL_ROUTES.metronome.home },
    layout: '1x1',
    summary: CORE_SUMMARY,
  },
  {
    id: TOOL_ID.tuner,
    name: 'Tuner',
    icon: 'tuner',
    routes: routesOf(TOOL_ROUTES.tuner),
    homeTile: { label: 'Tuner', route: TOOL_ROUTES.tuner.home },
    layout: '1x1',
    summary: CORE_SUMMARY,
  },
  {
    id: TOOL_ID.library,
    name: 'Songs',
    icon: 'songs',
    routes: routesOf(TOOL_ROUTES.library),
    homeTile: { label: 'Songs', route: TOOL_ROUTES.library.home },
    layout: '1x1',
    summary: 'Imported songs, beats analyzed',
  },
  {
    id: TOOL_ID.stems,
    name: 'Stem songs',
    icon: 'stems',
    routes: routesOf(TOOL_ROUTES.stems),
    homeTile: { label: 'Stem songs', route: TOOL_ROUTES.stems.home },
    layout: '1x1',
    summary: 'Mix and loop imported stems',
  },
  {
    id: TOOL_ID.sync,
    name: PLAY_ALONG_NAME,
    icon: 'playAlong',
    routes: routesOf(TOOL_ROUTES.sync),
    homeTile: { label: PLAY_ALONG_NAME, route: TOOL_ROUTES.sync.home },
    layout: 'row',
    summary: 'Needs notification access',
  },
  {
    id: TOOL_ID.practiceHistory,
    name: 'Practice history',
    icon: 'practice',
    routes: routesOf(TOOL_ROUTES.practiceHistory),
    homeTile: {
      label: 'Practice history',
      route: TOOL_ROUTES.practiceHistory.home,
    },
    layout: '1x1',
    shortcut: true,
  },
];

export interface BuiltTool extends HomeToolEntry {
  readonly homeTile: HomeTileDescriptor;
}

export const BUILT_TOOLS: readonly BuiltTool[] = HOME_TOOLS.filter(
  (tool): tool is BuiltTool =>
    tool.homeTile !== undefined && tool.shortcut !== true,
);

export const BUILT_TOOL_IDS: readonly string[] = BUILT_TOOLS.map((t) => t.id);

export function hasHomeTile(tool: HomeToolEntry): tool is BuiltTool {
  return tool.homeTile !== undefined;
}

export function toolStatus(tool: HomeToolEntry): ToolStatus {
  return tool.homeTile === undefined ? 'upcoming' : 'ready';
}

export function continueTarget(
  lastToolId: string | undefined,
  tools: readonly HomeToolEntry[],
  isOn: ToolOnTest,
): HomeToolEntry | undefined {
  if (lastToolId === undefined || !isOn(lastToolId)) return undefined;
  return tools.find((t) => t.id === lastToolId && t.homeTile !== undefined);
}
