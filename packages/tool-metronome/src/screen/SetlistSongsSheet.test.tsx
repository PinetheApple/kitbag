// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entry } from '../logic/fixtures.test-helper.ts';

const SETLIST_ID = 4;
const NIGHT_BUS = 9;
const STEM_ITEM = 2;

const fake = vi.hoisted(() => ({
  openStemEntry: vi.fn(() => Promise.resolve(true)),
  stop: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Badge: 'Badge',
  Button: 'Button',
  Sheet: 'Sheet',
  SheetHint: 'SheetHint',
  createThemedStyles: () => () => ({}),
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useStemSongs: () =>
    new Map([[NIGHT_BUS, { id: NIGHT_BUS, title: 'Night Bus' }]]),
  useLibrary: (select: (state: unknown) => unknown) =>
    select({
      loaded: null,
      entries: {
        [SETLIST_ID]: [
          entry(1, 'Warm-up'),
          { kind: 'stem', item: { id: STEM_ITEM }, stemSetId: NIGHT_BUS },
        ],
      },
      loadSong: vi.fn(),
      leaveSetlist: vi.fn(),
      openStemEntry: fake.openStemEntry,
    }),
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ stop: fake.stop }),
}));
vi.mock('./sheetStyles.ts', () => ({ useSheetStyles: () => ({}) }));
vi.mock('./UnsavedChanges.tsx', () => ({
  NowRowActions: () => null,
  UnsavedDot: () => null,
  useLoadedSongUnsaved: () => false,
}));

const { SetlistSongsSheet } = await import('./SetlistSongsSheet.tsx');

const onDismiss = vi.fn();
const onOpenStemSet = vi.fn();

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(SetlistSongsSheet, {
        visible: true,
        set: { id: SETLIST_ID, name: 'Gig', count: 2, position: undefined },
        bottomInset: 0,
        onDismiss,
        onOpenStemSet,
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

async function press(handler: unknown): Promise<void> {
  await act(async () => {
    (handler as () => void)();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a stem row in the setlist song list', () => {
  it('stops the click and opens the stem player only once the sheet has closed', async () => {
    const tree = mount();
    const row = tree.root.find(
      (node) =>
        node.type === ('Pressable' as never) &&
        node.props.accessibilityLabel === '2. Night Bus, stem song',
    );
    await press(row.props.onPress);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(fake.openStemEntry).toHaveBeenCalledWith(STEM_ITEM, SETLIST_ID);
    expect(fake.stop).not.toHaveBeenCalled();
    expect(onOpenStemSet).not.toHaveBeenCalled();
    const sheet = tree.root.find((node) => node.type === ('Sheet' as never));
    await press(sheet.props.onClosed);
    expect(onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(fake.stop).toHaveBeenCalledOnce();
    const [stopped] = fake.stop.mock.invocationCallOrder;
    const [opened] = onOpenStemSet.mock.invocationCallOrder;
    expect(stopped).toBeLessThan(opened ?? 0);
  });
});
