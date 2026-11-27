import { space } from '@kitbag/core-design';
import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  contentStyle,
  frameStyle,
  itKeepsSafeAreaInsetsOutOfTheScroll,
  NAV_BAR,
  renderRecorded,
} from '../safeAreaInsets.test-helper.ts';

interface MoreItem {
  readonly tool: { readonly id: string };
  readonly onPress: () => void;
}

const home = vi.hoisted(() => ({
  tiles: [] as { readonly id: string }[][],
  moreCounts: [] as number[],
  moreItems: [] as MoreItem[][],
  push: vi.fn<(href: string) => void>(),
  rows: [] as { readonly title: string; readonly subtitle: string }[],
  lockedSubtext: undefined as string | undefined,
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
    ToolRow: (props: { readonly title: string; readonly subtitle: string }) => {
      home.rows.push(props);
      return null;
    },
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

vi.mock('@kitbag/tool-sync', () => ({
  PLAY_ALONG_NAME: 'Play along',
  useLockedSubtext: () => home.lockedSubtext,
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: home.push }),
  useFocusEffect: () => undefined,
}));

vi.mock('../miniPlayer/useMiniPlayerDocked.ts', () => ({
  useAnyMiniPlayerDocked: () => dock.docked,
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
  MoreToolsSheet: (props: { readonly items: MoreItem[] }) => {
    home.moreItems.push(props.items);
    return null;
  },
}));

const { HomeScreen } = await import('./HomeScreen.tsx');
const { TOOL_ID } = await import('./registry.ts');
const { PLAY_ALONG_SUBTEXT } = await import('./subtext.ts');

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

  it('leaves the navigation bar to the mini-player rather than the frame', () => {
    expect(frameStyle()?.paddingBottom ?? 0).toBe(0);
  });
});

describe('HomeScreen tiles and More tools', () => {
  afterEach(() => {
    storeState.off = [];
  });

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

  it('opens each More tools row on its tool route', () => {
    listed([]);
    home.push.mockClear();
    for (const item of home.moreItems[0] ?? []) item.onPress();
    expect(home.push.mock.calls).toEqual([['/practice']]);
  });

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

describe('HomeScreen Play along row', () => {
  const syncSubtitle = (locked: string | undefined) => {
    home.lockedSubtext = locked;
    home.rows.length = 0;
    renderRecorded(createElement(HomeScreen));
    return home.rows.find((row) => row.title === 'Play along')?.subtitle;
  };

  it('names the lock while Play along follows a song', () => {
    expect(syncSubtitle('Locked · Spotify')).toBe('Locked · Spotify');
  });

  it('says what Play along does while nothing is locked', () => {
    expect(syncSubtitle(undefined)).toBe(PLAY_ALONG_SUBTEXT);
  });
});
