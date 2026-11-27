import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { songPreset } from '../logic/fixtures.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const library = vi.hoisted((): { state: Record<string, unknown> } => ({
  state: {},
}));

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
    PlainListRow: (props: Props) =>
      h('li', null, `${String(props.title)}: ${String(props.subtitle)}`),
  };
});

vi.mock('../screen/CustomSounds.tsx', () => ({
  useCustomSoundViews: () => [],
}));
vi.mock('./DetailMenu.tsx', () => ({ NEW_SONG_NAME: 'New song' }));
vi.mock('./SongMenu.tsx', () => ({
  SongMenuSheets: () => null,
  useSongMenu: () => ({}),
}));
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
