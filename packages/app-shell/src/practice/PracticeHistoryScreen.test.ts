import { space } from '@kitbag/core-design';
import { createElement } from 'react';
import { beforeAll, describe, vi } from 'vitest';

import {
  itKeepsSafeAreaInsetsOutOfTheScroll,
  renderRecorded,
} from '../safeAreaInsets.test-helper.ts';

vi.mock('react-native', async () => ({
  ...(await import('../safeAreaInsets.test-helper.ts')).reactNativeMock,
  Text: 'span',
}));

vi.mock(
  'react-native-safe-area-context',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).safeAreaContextMock,
);

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: () => null,
  EmptyState: () => null,
  SegmentedControl: () => null,
  Snackbar: () => null,
  textStyle: () => ({}),
  createThemedStyles: (await import('../safeAreaInsets.test-helper.ts'))
    .createThemedStylesMock,
}));

vi.mock('./HistoryGraph.tsx', () => ({ HistoryGraph: () => null }));
vi.mock('./HistoryList.tsx', () => ({ HistoryList: () => null }));
vi.mock('./SessionActionsSheet.tsx', () => ({
  SessionActionsSheet: () => null,
}));

vi.mock('./usePracticeHistoryScreen.ts', () => ({
  usePracticeHistoryScreen: () => ({
    ready: true,
    failed: false,
    sessions: [{}],
    stats: null,
    deletedText: null,
    actions: { target: null },
    refresh: () => Promise.resolve(),
  }),
}));

const { PracticeHistoryScreen } = await import('./PracticeHistoryScreen.tsx');

describe('PracticeHistoryScreen safe-area insets', () => {
  beforeAll(() => {
    renderRecorded(
      createElement(PracticeHistoryScreen, {
        onBack: () => undefined,
        onOpenSession: () => undefined,
        onOpenMetronome: () => undefined,
      }),
    );
  });

  itKeepsSafeAreaInsetsOutOfTheScroll(space.screenInset);
});
