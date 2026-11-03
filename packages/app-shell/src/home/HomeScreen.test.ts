import { space } from '@kitbag/core-design';
import { createElement } from 'react';
import { beforeAll, describe, vi } from 'vitest';

import {
  itKeepsSafeAreaInsetsOutOfTheScroll,
  renderRecorded,
} from '../safeAreaInsets.test-helper.ts';

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
  off: [],
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
    AppBarAction: () => null,
    Button: () => null,
    ToolGrid: () => null,
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
}));

vi.mock('./ArrangeSheet.tsx', () => ({ ArrangeSheet: () => null }));
vi.mock('./MoreToolsRow.tsx', () => ({ MoreToolsRow: () => null }));

const { HomeScreen } = await import('./HomeScreen.tsx');

beforeAll(() => {
  renderRecorded(createElement(HomeScreen));
});

describe('HomeScreen safe-area insets', () => {
  itKeepsSafeAreaInsetsOutOfTheScroll(space.screenInset);
});
