// react-test-renderer is deprecated, but it alone keeps state across renders with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles },
}));

const world = vi.hoisted(() => {
  const drawn: Partial<Record<string, Props>> = {};
  return { lock: undefined as object | undefined, drawn };
});

vi.mock('@kitbag/core-state', () => ({
  soundChipLabel: () => '',
  useMediaSessions: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      access: true,
      sessions: [],
      openSettings: () => Promise.resolve(true),
    }),
}));

vi.mock('@kitbag/core-design', () => ({
  createThemedStyles: () => () => ({}),
}));

vi.mock('./playAlongHooks.ts', () => ({
  useFollowedSession: () => ({ sessionId: 'spotify' }),
  usePlayAlong: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ lock: world.lock, pattern: { sounds: {} } }),
  useSessionWatchWhileLocked: () => undefined,
  useLibraryWatch: () => undefined,
  useTempoLine: () => ({ bpm: null, line: { lead: '', rung: '' } }),
}));

vi.mock('./useAccessFlow.ts', () => ({
  useAccessFlow: () => ({ askedForAccess: true, declined: false }),
}));

const capture = vi.hoisted(() => (name: string) => () => ({
  [name]: (props: Props) => {
    world.drawn[name] = props;
    return null;
  },
}));
vi.mock('./PlayAlongBody.tsx', capture('PlayAlongBody'));
vi.mock('./PlayAlongMenu.tsx', capture('PlayAlongMenu'));
vi.mock('./SaveSheet.tsx', capture('SaveSheet'));
vi.mock('./PhaseSheet.tsx', capture('PhaseSheet'));
vi.mock('./PermissionExplainer.tsx', () => ({
  PermissionExplainer: () => null,
}));
vi.mock('./PlayAlongDock.tsx', () => ({
  PlayAlongDock: () => null,
  ClickDock: () => null,
}));
vi.mock('./PlayAlongAppBar.tsx', () => ({ PlayAlongAppBar: () => null }));
vi.mock('./ClickSoundSheet.tsx', () => ({ ClickSoundSheet: () => null }));
vi.mock('./SourceSheet.tsx', () => ({ SourceSheet: () => null }));
vi.mock('./TempoSheet.tsx', () => ({ TempoSheet: () => null }));
vi.mock('./PatternSheets.tsx', () => ({
  PATTERN_SHEET: { meter: 'meter', subdivision: 'subdivision' },
  PatternSheets: () => null,
}));

const { PlayAlongScreen } = await import('./PlayAlongScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LOCK = { sessionId: 'spotify' };
let renderer: ReactTestRenderer | null = null;

const screen = () =>
  createElement(PlayAlongScreen, { insets: { top: 0, bottom: 0 } });

function setLock(lock: object | undefined): void {
  world.lock = lock;
  act(() => {
    renderer?.update(screen());
  });
}

function press(name: string, prop: string): void {
  act(() => {
    (world.drawn[name]?.[prop] as () => void)();
  });
}

beforeEach(() => {
  world.lock = LOCK;
  world.drawn = {};
  act(() => {
    renderer = create(screen());
  });
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe('sheets that need the lock', () => {
  it('does not reopen Save for this song when a new lock lands', () => {
    press('PlayAlongMenu', 'onSave');
    expect(world.drawn.SaveSheet?.visible).toBe(true);
    setLock(undefined);
    setLock(LOCK);
    expect(world.drawn.SaveSheet?.visible).toBe(false);
  });

  it('does not reopen the phase sheet when a new lock lands', () => {
    press('PlayAlongBody', 'onOpenPhase');
    expect(world.drawn.PhaseSheet?.visible).toBe(true);
    setLock(undefined);
    setLock(LOCK);
    expect(world.drawn.PhaseSheet?.visible).toBe(false);
  });
});
