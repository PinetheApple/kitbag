import { space } from '@kitbag/core-design';
import { createElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  contentStyle,
  itKeepsSafeAreaInsetsOutOfTheScroll,
  NAV_BAR,
  renderRecorded,
} from '../safeAreaInsets.test-helper.ts';

const home = vi.hoisted(() => ({
  tiles: [] as { readonly id: string }[][],
  moreCounts: [] as number[],
  moreItems: [] as { readonly tool: { readonly id: string } }[][],
}));

const dock = vi.hoisted(() => ({
  docked: false,
  bottomInsets: [] as number[],
  queueOpeners: [] as unknown[],
  openQueue: () => undefined,
}));

const storeState = vi.hoisted(() => ({
  bpm: 120,
  beatsPerBar: 4,
  denominator: 4,
  running: false,
  ramp: { enabled: false, startBpm: 120, targetBpm: 120 },
  tuning: undefined,
  rows: [],
  failed: false,
  toolId: undefined,
  arrangement: undefined,
  arrange: () => undefined,
  off: [] as string[],
}));

vi.mock(
  'react-native',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).reactNativeMock,
);

vi.mock(
  'react-native-safe-area-context',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).safeAreaContextMock,
);

vi.mock('@kitbag/core-design', async (original) => {
  const pure = await original<Record<string, unknown>>();
  return {
    ...pure,
    AppBar: () => null,
    Button: () => null,
    ToolGrid: (props: { readonly tiles: { readonly id: string }[] }) => {
      home.tiles.push(props.tiles);
      return null;
    },
    ToolRow: () => null,
    createThemedStyles: (await import('../safeAreaInsets.test-helper.ts'))
      .createThemedStylesMock,
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const useStore = <T>(selector: (state: typeof storeState) => T) =>
    selector(storeState);
  return {
    ...(await original<Record<string, unknown>>()),
    useHomeLayout: useStore,
    useLastTool: useStore,
    useMetronome: useStore,
    useSongLibrary: useStore,
    useTools: useStore,
    useTuner: useStore,
  };
});

vi.mock('@kitbag/tool-tuner', () => ({
  DEFAULT_TUNING: {},
  tuningLabel: () => 'Standard',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: () => undefined }),
  useFocusEffect: () => undefined,
}));

vi.mock('../miniPlayer/useMiniPlayerDocked.ts', () => ({
  useMiniPlayerDocked: () => dock.docked,
}));

vi.mock('../miniPlayer/DockedMiniPlayer.tsx', () => ({
  DockedMiniPlayer: (props: {
    readonly bottomInset: number;
    readonly onOpenQueue: unknown;
  }) => {
    dock.bottomInsets.push(props.bottomInset);
    dock.queueOpeners.push(props.onOpenQueue);
    return null;
  },
}));

vi.mock('../queue/useQueueSheet.tsx', () => ({
  useQueueSheet: () => ({ open: dock.openQueue, sheet: null }),
}));

vi.mock('./ArrangeSheet.tsx', () => ({ ArrangeSheet: () => null }));
vi.mock('./MoreToolsRow.tsx', () => ({
  MoreToolsRow: (props: { readonly count: number }) => {
    home.moreCounts.push(props.count);
    return null;
  },
}));
vi.mock('./MoreToolsSheet.tsx', () => ({
  MoreToolsSheet: (props: {
    readonly items: { readonly tool: { readonly id: string } }[];
  }) => {
    home.moreItems.push(props.items);
    return null;
  },
}));

const { HomeScreen } = await import('./HomeScreen.tsx');
const { TOOL_ID } = await import('./registry.ts');

describe('HomeScreen safe-area insets', () => {
  beforeAll(() => {
    dock.docked = false;
    renderRecorded(createElement(HomeScreen));
  });

  itKeepsSafeAreaInsetsOutOfTheScroll(space.screenInset);

  it('docks no mini-player', () => {
    expect(dock.bottomInsets).toEqual([]);
  });
});

describe('HomeScreen with the mini-player docked', () => {
  beforeAll(() => {
    dock.docked = true;
    renderRecorded(createElement(HomeScreen));
  });

  it('hands the navigation bar inset to the mini-player', () => {
    expect(dock.bottomInsets).toEqual([NAV_BAR]);
  });

  it('opens the queue sheet from the mini-player', () => {
    expect(dock.queueOpeners).toEqual([dock.openQueue]);
  });

  it('ends the scroll above the mini-player, not the navigation bar', () => {
    expect(contentStyle().paddingBottom).toBe(space.screenInset);
  });
});

describe('HomeScreen tiles and More tools', () => {
  const listed = (off: string[]) => {
    storeState.off = off;
    home.tiles.length = 0;
    home.moreCounts.length = 0;
    home.moreItems.length = 0;
    renderRecorded(createElement(HomeScreen));
    return {
      tiles: home.tiles[0]?.map((tile) => tile.id),
      count: home.moreCounts[0],
      more: home.moreItems[0]?.map((item) => item.tool.id),
    };
  };

  it('on a fresh install puts only Practice history under More tools', () => {
    expect(listed([])).toEqual({
      tiles: [TOOL_ID.metronome, TOOL_ID.tuner, TOOL_ID.library, TOOL_ID.stems],
      count: 1,
      more: [TOOL_ID.practiceHistory],
    });
  });

  it('leaves a tool that is off out of both', () => {
    expect(listed([TOOL_ID.tuner])).toEqual({
      tiles: [TOOL_ID.metronome, TOOL_ID.library, TOOL_ID.stems],
      count: 1,
      more: [TOOL_ID.practiceHistory],
    });
  });
});
