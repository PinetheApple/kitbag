import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { songPreset } from '../logic/fixtures.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const library = vi.hoisted((): { state: Record<string, unknown> } => ({
  state: {},
}));
const seen = vi.hoisted(() => {
  const songMenu: Record<string, unknown> = { kind: 'none', target: null };
  return {
    rows: [] as Props[],
    sheets: [] as Props[],
    openActions: vi.fn(),
    songMenu,
  };
});

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => h('div', null, props.children),
    Text: (props: Props) => h('span', null, props.children),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useLibrary: (select: (state: unknown) => unknown) => select(library.state),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    AppBar: () => null,
    Badge: () => null,
    Chip: () => null,
    ChipRow: () => null,
    EmptyState: () => null,
    PlainListRow: (props: Props) => {
      seen.rows.push(props);
      return h('li', null, `${String(props.title)}: ${String(props.subtitle)}`);
    },
  };
});

vi.mock('../screen/CustomSounds.tsx', () => ({
  useCustomSoundViews: () => [],
}));
vi.mock('./DetailMenu.tsx', () => ({ NEW_SONG_NAME: 'New song' }));
vi.mock('./SongMenu.tsx', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  SongMenuSheets: (props: Props) => {
    seen.sheets.push(props);
    return null;
  },
  useSongMenu: () => ({ ...seen.songMenu, openActions: seen.openActions }),
}));
vi.mock('./sheets.tsx', () => ({ ActionsSheet: () => null, guarded: vi.fn() }));
vi.mock('./ScreenFrame.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    ScreenFrame: (props: Props) => h('main', null, props.children),
  };
});
vi.mock('./useLibraryRefresh.ts', () => ({
  useLibraryRefresh: () => undefined,
}));

const { AllSongsScreen } = await import('./AllSongsScreen.tsx');

const ignore = () => undefined;

function rowsOf(standalone: readonly unknown[]): string {
  seen.rows = [];
  seen.sheets = [];
  library.state = { ready: true, loaded: null, standalone };
  return renderToStaticMarkup(
    createElement(AllSongsScreen, {
      insets: { top: 0, bottom: 0 },
      onBack: ignore,
      onEditPreset: ignore,
      onLoaded: ignore,
    }),
  );
}

describe('All songs rows', () => {
  const plain = { rampEnabled: false, notes: null, countInBars: 0 };

  it('shows the song’s tempo in place of the BPM for a song that saves none', () => {
    const untimed = songPreset({ ...plain, name: 'Saved', bpm: null });
    expect(rowsOf([untimed])).toContain(
      'Saved: Tempo from the song · 3/4 · Woodblock',
    );
  });

  it('shows a saved tempo as before', () => {
    const timed = songPreset({ ...plain, name: 'Timed', bpm: 96 });
    expect(rowsOf([timed])).toContain('Timed: 96 · 3/4 · Woodblock');
  });
});

describe('All songs actions button', () => {
  const song = songPreset({ id: 7, name: 'Blackbird (slow)' });

  beforeEach(() => {
    seen.openActions.mockClear();
    seen.songMenu = { kind: 'none', target: null };
  });

  it('opens the song sheet with no set, so it offers Add to setlist', () => {
    rowsOf([song]);
    (seen.rows[0]?.onActions as () => void)();
    expect(seen.openActions).toHaveBeenCalledWith({
      preset: song,
      itemId: null,
    });
    expect(seen.sheets[0]?.setlistId).toBeNull();
  });

  it('tints the row while its sheet is open', () => {
    seen.songMenu = { kind: 'actions', target: { preset: song, itemId: null } };
    rowsOf([song, songPreset({ id: 8, name: 'Other' })]);
    expect(seen.rows.map((row) => row.menuOpen)).toEqual([true, false]);
  });
});
