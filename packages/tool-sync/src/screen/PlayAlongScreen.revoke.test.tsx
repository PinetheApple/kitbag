// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

const listener = vi.hoisted(() => ({ enabled: true }));

vi.mock('react-native', () => ({
  View: 'View',
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
}));

vi.mock('./playAlongHooks.ts', () => ({
  useFollowedSession: () => undefined,
  usePlayAlong: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ lock: undefined, pattern: { sounds: [] } }),
  useSessionWatchWhileLocked: () => undefined,
  useLibraryWatch: () => undefined,
  useTempoLine: () => ({ bpm: null, line: { lead: '', rung: '' } }),
}));

vi.mock('./PermissionExplainer.tsx', () => ({
  PermissionExplainer: 'PermissionExplainer',
}));
vi.mock('./PlayAlongBody.tsx', () => ({ PlayAlongBody: 'PlayAlongBody' }));
vi.mock('./PlayAlongDock.tsx', () => ({
  PlayAlongDock: 'PlayAlongDock',
  ClickDock: 'ClickDock',
}));
vi.mock('./PlayAlongAppBar.tsx', () => ({ PlayAlongAppBar: () => null }));
vi.mock('./PlayAlongMenu.tsx', () => ({ PlayAlongMenu: () => null }));
vi.mock('./PatternSheets.tsx', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  PatternSheets: () => null,
}));
vi.mock('./ClickSoundSheet.tsx', () => ({ ClickSoundSheet: () => null }));
vi.mock('./SourceSheet.tsx', () => ({ SourceSheet: () => null }));
vi.mock('./TempoSheet.tsx', () => ({ TempoSheet: () => null }));
vi.mock('./PhaseSheet.tsx', () => ({ PhaseSheet: () => null }));
vi.mock('./SaveSheet.tsx', () => ({ SaveSheet: () => null }));

const { configureMediaSessions, getMediaSessionsStore } =
  await import('@kitbag/core-state');
configureMediaSessions({
  source: {
    subscribe: () => () => undefined,
    command: () => undefined,
    listenerEnabled: () => Promise.resolve(listener.enabled),
    openListenerSettings: () => Promise.resolve(true),
    rearm: () => undefined,
  },
  choose: () => undefined,
  explainerDeclined: { load: () => false, save: () => undefined },
});

const { PlayAlongScreen } = await import('./PlayAlongScreen.tsx');

async function foregroundRefresh(): Promise<void> {
  await act(async () => {
    await getMediaSessionsStore().getState().refresh();
  });
}

function shows(tree: ReactTestRenderer | undefined, name: string): boolean {
  return (tree?.root.findAllByType(name as never).length ?? 0) > 0;
}

it('leaves the granted screen for the explainer when a foreground re-read finds access revoked', async () => {
  await foregroundRefresh();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(PlayAlongScreen, { insets: { top: 0, bottom: 0 } }),
    );
  });
  expect(shows(tree, 'PlayAlongBody')).toBe(true);

  listener.enabled = false;
  await foregroundRefresh();

  expect(shows(tree, 'PlayAlongBody')).toBe(false);
  expect(shows(tree, 'PermissionExplainer')).toBe(true);
});
