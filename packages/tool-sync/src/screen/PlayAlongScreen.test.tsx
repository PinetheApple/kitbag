import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: host,
    Pressable: host,
    ScrollView: host,
    AppState: { addEventListener: () => ({ remove: () => undefined }) },
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

const world = vi.hoisted(() => ({
  access: undefined as boolean | undefined,
  session: undefined as object | undefined,
  lock: undefined as object | undefined,
  sounds: { normal: 1, accent: 1 },
  menu: undefined as Props | undefined,
  declined: false,
  watchLibrary: vi.fn(),
}));

vi.mock('@kitbag/core-state', async (original) => ({
  soundChipLabel: (await original<Record<string, unknown>>()).soundChipLabel,
  useMediaSessions: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      access: world.access,
      sessions: [],
      openSettings: () => Promise.resolve(true),
    }),
}));

vi.mock('@kitbag/core-design', () => ({
  createThemedStyles: () => () => ({}),
}));

vi.mock('./playAlongHooks.ts', () => ({
  useFollowedSession: () => world.session,
  usePlayAlong: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ lock: world.lock, pattern: { sounds: world.sounds } }),
  useSessionWatchWhileLocked: () => undefined,
  useLibraryWatch: world.watchLibrary,
  useTempoLine: () => ({ bpm: null, line: { lead: '', rung: '' } }),
}));

vi.mock('./useAccessFlow.ts', () => ({
  useAccessFlow: () => ({
    askedForAccess: false,
    declined: world.declined,
    openAccess: vi.fn(),
    notNow: vi.fn(),
    explainAgain: vi.fn(),
  }),
}));

const marker = vi.hoisted(() => (name: string) => async () => {
  const { createElement: h } = await import('react');
  return { [name]: () => h('i', null, name) };
});
vi.mock('./PermissionExplainer.tsx', marker('PermissionExplainer'));
vi.mock('./PlayAlongBody.tsx', marker('PlayAlongBody'));
vi.mock('./PlayAlongDock.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    PlayAlongDock: () => h('i', null, 'PlayAlongDock'),
    ClickDock: () => h('i', null, 'ClickDock'),
  };
});
vi.mock('./PlayAlongAppBar.tsx', () => ({ PlayAlongAppBar: () => null }));
vi.mock('./PlayAlongMenu.tsx', () => ({
  PlayAlongMenu: (props: Props) => {
    world.menu = props;
    return null;
  },
}));
vi.mock('./ClickSoundSheet.tsx', () => ({ ClickSoundSheet: () => null }));
vi.mock('./SourceSheet.tsx', () => ({ SourceSheet: () => null }));
vi.mock('./TempoSheet.tsx', () => ({ TempoSheet: () => null }));
vi.mock('./PatternSheets.tsx', () => ({
  PATTERN_SHEET: { meter: 'meter', subdivision: 'subdivision' },
  PatternSheets: () => null,
}));

const { PlayAlongScreen } = await import('./PlayAlongScreen.tsx');
const { soundChipLabel } = await import('@kitbag/core-state');

function shown(): string {
  return renderToStaticMarkup(
    createElement(PlayAlongScreen, { insets: { top: 0, bottom: 0 } }),
  );
}

beforeEach(() => {
  world.access = undefined;
  world.session = undefined;
  world.lock = undefined;
  world.menu = undefined;
  world.declined = false;
});

describe('PlayAlongScreen', () => {
  it('draws nothing but the bar while the grant is being read', () => {
    expect(shown()).not.toMatch(
      /PermissionExplainer|PlayAlongBody|PlayAlongDock/,
    );
  });

  it('explains the grant when access is off', () => {
    world.access = false;
    const markup = shown();
    expect(markup).toContain('PermissionExplainer');
    expect(markup).not.toMatch(/PlayAlongBody|PlayAlongDock|ClickDock/);
  });

  it('docks only the click key when nothing plays', () => {
    world.access = true;
    const markup = shown();
    expect(markup).toMatch(/PlayAlongBody.*ClickDock/);
    expect(markup).not.toContain('PlayAlongDock');
  });

  it('docks only the click key once access was declined', () => {
    world.access = false;
    world.declined = true;
    const markup = shown();
    expect(markup).toMatch(/PlayAlongBody.*ClickDock/);
    expect(markup).not.toContain('PlayAlongDock');
  });

  it('watches the library for an offer', () => {
    world.access = true;
    shown();
    expect(world.watchLibrary).toHaveBeenCalled();
  });

  it('docks the song transport once a song is followed', () => {
    world.access = true;
    world.session = {};
    const markup = shown();
    expect(markup).toMatch(/PlayAlongBody.*PlayAlongDock/);
    expect(markup).not.toContain('ClickDock');
  });

  it('keeps the dock through the hold after the followed app went away', () => {
    world.access = true;
    world.lock = {};
    expect(shown()).toContain('PlayAlongDock');
  });

  it('names the play along click sound in the menu', () => {
    world.access = true;
    world.sounds = { normal: 1, accent: 3 };
    shown();
    expect(world.menu?.soundLabel).toBe(soundChipLabel(world.sounds));
  });
});
