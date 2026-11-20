// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { entry, summary } from '../logic/fixtures.test-helper.ts';

const SETLIST_ID = 4;
const REMOVED_ITEM = 3;

const stage = vi.hoisted(() => ({
  entries: [] as unknown[],
  index: 0,
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: (props: { readonly children?: ReactNode }) => props.children,
  BarIconButton: 'BarIconButton',
  Icon: 'Icon',
  createThemedStyles: () => () => ({}),
  useTheme: () => ({ accentInk: 'accent' }),
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useStemSongs: () => new Map(),
  useLibrary: (select: (state: unknown) => unknown) =>
    select({
      setlists: [summary(SETLIST_ID, 'Gig', true, stage.entries.length)],
      entries: { [SETLIST_ID]: stage.entries },
      presets: [],
      loaded: {
        presetId: REMOVED_ITEM,
        itemId: REMOVED_ITEM,
        setlistId: SETLIST_ID,
        index: stage.index,
      },
    }),
}));
vi.mock('./SetlistSongsSheet.tsx', () => ({ SetlistSongsSheet: () => null }));
vi.mock('./LoadedSongSheet.tsx', () => ({ LoadedSongSheet: () => null }));
vi.mock('./UnsavedChanges.tsx', () => ({
  UnsavedDot: () => null,
  useLoadedSongUnsaved: () => false,
}));
vi.mock('./useStepSong.ts', () => ({ useStepSong: () => vi.fn() }));

const { MetronomeAppBar } = await import('./MetronomeAppBar.tsx');

function stepButtons(): Record<string, boolean> {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(MetronomeAppBar, { bottomInset: 0 }));
  });
  const buttons = tree?.root.findAll(
    (node) => node.type === ('BarIconButton' as never),
  );
  return Object.fromEntries(
    (buttons ?? []).map((button) => [
      button.props.icon as string,
      button.props.disabled as boolean,
    ]),
  );
}

describe('the stage bar after the on-stage song is removed', () => {
  it('disables Next when the removed song was the last', () => {
    stage.entries = [entry(1, 'A'), entry(2, 'B')];
    stage.index = 2;
    expect(stepButtons()).toEqual({ previous: false, next: true });
  });

  it('keeps Next for the song that took the removed one’s place', () => {
    stage.entries = [entry(1, 'A'), entry(2, 'B')];
    stage.index = 1;
    expect(stepButtons()).toEqual({ previous: false, next: false });
  });
});
