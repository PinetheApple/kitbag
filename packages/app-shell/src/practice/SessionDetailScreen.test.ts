import { practiceHistory } from '@kitbag/core-design';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  frameStyle,
  NAV_BAR,
  renderRecorded,
  viewStyles,
} from '../safeAreaInsets.test-helper.ts';

const detail = vi.hoisted((): { plan: unknown; load: unknown } => ({
  plan: null,
  load: null,
}));

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
  Button: () => null,
  textStyle: () => ({}),
  createThemedStyles: (await import('../safeAreaInsets.test-helper.ts'))
    .createThemedStylesMock,
}));

vi.mock('@kitbag/core-state', () => ({
  formatClockSeconds: () => '',
  SESSION_LOAD: { song: 'song' },
}));

vi.mock('./detailText.ts', () => ({
  detailHeading: () => ({ title: '', subtitle: '' }),
  LOAD_HINT: '',
  loadLabel: () => '',
  OLD_SESSION_NOTE: '',
  repeatHint: () => '',
  summaryHint: () => '',
}));

vi.mock('./OldSessionSongs.tsx', () => ({ OldSessionSongs: () => null }));
vi.mock('./TimelineRows.tsx', () => ({ TimelineRows: () => null }));
vi.mock('./SessionActionsSheet.tsx', () => ({ DELETE_SESSION_LABEL: '' }));

vi.mock('./useSessionDetail.ts', () => ({
  useSessionDetail: () => ({
    session: { durationSeconds: 0, songUuids: [] },
    timeline: [],
    setlistSize: 0,
    names: {},
    now: 0,
    plan: detail.plan,
    load: detail.load,
    deleteSession: () => undefined,
  }),
}));

const { SessionDetailScreen } = await import('./SessionDetailScreen.tsx');

function render(plan: unknown) {
  detail.plan = plan;
  renderRecorded(
    createElement(SessionDetailScreen, {
      uuid: 'session',
      onBack: () => undefined,
      onLoaded: () => undefined,
    }),
  );
}

describe('SessionDetailScreen safe-area insets', () => {
  it('pads the navigation bar on the frame when no action sits below the list', () => {
    render(null);
    expect(frameStyle()?.paddingBottom).toBe(NAV_BAR);
  });

  it('pads the navigation bar once when the action sits below the list', () => {
    render({});
    const foot = viewStyles().find((s) => s.borderTopWidth !== undefined);
    expect(frameStyle()?.paddingBottom).toBe(NAV_BAR);
    expect(foot?.paddingBottom).toBe(practiceHistory.footBottom);
  });
});
