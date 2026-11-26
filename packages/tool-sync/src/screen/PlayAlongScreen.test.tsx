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
}));

vi.mock('@kitbag/core-state', () => ({
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
    selector({ lock: world.lock }),
  useSessionWatchWhileLocked: () => undefined,
  useSongTempo: () => undefined,
  useTempoLine: () => ({ bpm: null, line: { lead: '', rung: '' } }),
}));

vi.mock('./useAccessFlow.ts', () => ({
  useAccessFlow: () => ({
    askedForAccess: false,
    declined: false,
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
vi.mock('./PlayAlongDock.tsx', marker('PlayAlongDock'));
vi.mock('./PlayAlongAppBar.tsx', () => ({ PlayAlongAppBar: () => null }));
vi.mock('./PlayAlongMenu.tsx', () => ({ PlayAlongMenu: () => null }));
vi.mock('./SourceSheet.tsx', () => ({ SourceSheet: () => null }));
vi.mock('./TempoSheet.tsx', () => ({ TempoSheet: () => null }));

const { PlayAlongScreen } = await import('./PlayAlongScreen.tsx');

function shown(): string {
  return renderToStaticMarkup(
    createElement(PlayAlongScreen, { insets: { top: 0, bottom: 0 } }),
  );
}

beforeEach(() => {
  world.access = undefined;
  world.session = undefined;
  world.lock = undefined;
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
    expect(markup).not.toMatch(/PlayAlongBody|PlayAlongDock/);
  });

  it('shows the body without a dock when nothing plays', () => {
    world.access = true;
    const markup = shown();
    expect(markup).toContain('PlayAlongBody');
    expect(markup).not.toContain('PlayAlongDock');
  });

  it('docks the song transport once a song is followed', () => {
    world.access = true;
    world.session = {};
    expect(shown()).toMatch(/PlayAlongBody.*PlayAlongDock/);
  });

  it('keeps the dock through the hold after the followed app went away', () => {
    world.access = true;
    world.lock = {};
    expect(shown()).toContain('PlayAlongDock');
  });
});
