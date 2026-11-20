// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { LibraryRow, LibrarySongRow } from '@kitbag/core-state';
import { act, createElement, useEffect, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { REANALYZE_LABEL } from '../logic/viewText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const NIGHT_BUS = 21;
const GIG = 5;

const shown = vi.hoisted(
  (): { failure: unknown; files: unknown; queue: number[] } => ({
    failure: null,
    files: null,
    queue: [],
  }),
);

const queue = vi.hoisted(() => ({
  enqueue: vi.fn<(stemSetId: number) => Promise<void>>(() => Promise.resolve()),
  refresh: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-native', () => ({ View: 'View', TextInput: 'TextInput' }));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    Button: (props: Props) => h('Button', props),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', null, props.children) : null,
    SheetHint: (props: Props) => h('SheetHint', null, props.children),
    SetlistPickerSheet: (props: Props) => h('Picker', props),
    NoticeSnackbar: (props: {
      notice: { shown: { message: string; action?: unknown } | null };
    }) =>
      props.notice.shown === null
        ? null
        : h('Snack', {
            message: props.notice.shown.message,
            action: props.notice.shown.action,
          }),
    TextField: () => null,
    createThemedStyles: () => () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: unknown) => unknown) =>
    select({ codes: {}, replacePrompt: null }),
  usePlayOrder: (select: (state: unknown) => unknown) => select(queue),
  useIsQueued: (stemSetId: number | null) =>
    stemSetId !== null && shown.queue.includes(stemSetId),
  useSetlistPicker: () => ({
    picks: [],
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    onCreate: vi.fn(),
  }),
  analysisFailure: () => shown.failure,
  rowFilesOf: () => shown.files,
  cleanName: (name: string) => name,
}));

const { LibrarySheets, useLibraryMenu } = await import('./LibrarySheets.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function openActions(
  failure: unknown,
  files: unknown = null,
): ReactTestRenderer {
  shown.failure = failure;
  shown.files = files;
  const menu = {
    kind: 'actions',
    target: { kind: 'song', id: 1, title: 'A song' } as LibrarySongRow,
    openActions: vi.fn(),
    openRename: vi.fn(),
    openDelete: vi.fn(),
    openSetlists: vi.fn(),
    close: vi.fn(),
  } as const;
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(LibrarySheets, {
        menu,
        bottomInset: 0,
        onOpenSetlist: vi.fn(),
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function sheet(tree: ReactTestRenderer) {
  const actions = tree.root.findByType('Sheet' as never);
  return {
    hint: actions.findAllByType('SheetHint' as never)[0]?.props
      .children as unknown,
    buttons: actions
      .findAllByType('Button' as never)
      .map((button) => button.props.label as unknown),
  };
}

describe('the actions sheet of a song whose analysis failed', () => {
  it('names an unsupported format and offers no Re-analyse', () => {
    const actions = sheet(
      openActions({
        kind: 'unsupported',
        keptGrid: false,
        format: 'm4a',
        supported: ['WAV', 'MP3', 'FLAC', 'AIFF'],
      }),
    );
    expect(actions.hint).toBe(
      'M4A isn’t supported. Kitbag plays WAV, MP3, FLAC or AIFF.',
    );
    expect(actions.buttons).not.toContain(REANALYZE_LABEL);
  });

  it('says a supported file may be damaged and offers Re-analyse', () => {
    const actions = sheet(openActions({ kind: 'damaged', keptGrid: false }));
    expect(actions.hint).toBe(
      'This file could not be read in full and may be damaged or incomplete, so there is no beat grid to lock to.',
    );
    expect(actions.buttons).toContain(REANALYZE_LABEL);
  });

  it('offers no Re-analyse when the file is missing', () => {
    const actions = sheet(
      openActions({ kind: 'missingFile', keptGrid: false }),
    );
    expect(actions.buttons).not.toContain(REANALYZE_LABEL);
  });
});

describe('the actions sheet of a song on a missing SD card', () => {
  it('offers neither Re-analyse nor Delete, and says why', () => {
    const actions = sheet(openActions(null, 'unavailable'));
    expect(actions.buttons).toEqual(['Rename']);
    expect(actions.hint).toBe(
      'This song is on the SD card, so it can’t play until the card is back.',
    );
  });

  it('keeps both once the card is back', () => {
    const actions = sheet(openActions(null, 'present'));
    expect(actions.buttons).toEqual(['Rename', REANALYZE_LABEL, 'Delete song']);
  });
});

const nightBus = {
  kind: 'stems',
  id: NIGHT_BUS,
  title: 'Night Bus',
} as LibraryRow;

interface Library {
  readonly tree: ReactTestRenderer;
  readonly onOpenSetlist: ReturnType<typeof vi.fn>;
}

function Harness({
  row,
  onOpenSetlist,
}: {
  readonly row: LibraryRow;
  readonly onOpenSetlist: (setlistId: number) => void;
}) {
  const menu = useLibraryMenu();
  const { openActions: open } = menu;
  useEffect(() => {
    open(row);
  }, [open, row]);
  return createElement(LibrarySheets, { menu, bottomInset: 0, onOpenSetlist });
}

function openStemRow(files: unknown, queued: number[] = []): Library {
  shown.failure = null;
  shown.files = files;
  shown.queue = queued;
  queue.enqueue.mockClear();
  const onOpenSetlist = vi.fn();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(Harness, { row: nightBus, onOpenSetlist }));
  });
  if (tree === undefined) throw new Error('not mounted');
  return { tree, onOpenSetlist };
}

function button(tree: ReactTestRenderer, label: string) {
  return tree.root.find(
    (node) => node.type === ('Button' as never) && node.props.label === label,
  );
}

async function press(tree: ReactTestRenderer, label: string): Promise<void> {
  await act(async () => {
    (button(tree, label).props.onPress as () => void)();
    await Promise.resolve();
  });
}

function picker(tree: ReactTestRenderer) {
  return tree.root.findByType('Picker' as never);
}

function snack(tree: ReactTestRenderer) {
  return tree.root.findAllByType('Snack' as never)[0]?.props as
    | { message: string; action?: { label: string; onPress: () => void } }
    | undefined;
}

describe('the actions sheet of a stem song', () => {
  it('offers Play next and Add to setlist above Rename', () => {
    const { tree } = openStemRow('present');
    expect(sheet(tree).buttons).toEqual([
      'Play next',
      'Add to setlist',
      'Rename',
      'Delete stem song',
    ]);
  });

  it('offers only Rename while its card is away', () => {
    const { tree } = openStemRow('unavailable');
    expect(sheet(tree).buttons).toEqual(['Rename']);
  });

  it('reads In Up next, disabled, once the song is queued', () => {
    const { tree } = openStemRow('present', [NIGHT_BUS]);
    expect(button(tree, 'In Up next').props.disabled).toBe(true);
    expect(sheet(tree).buttons).not.toContain('Play next');
  });

  it('queues the song, closes the sheet and says so', async () => {
    const { tree } = openStemRow('present');
    await press(tree, 'Play next');
    expect(queue.enqueue).toHaveBeenCalledWith(NIGHT_BUS);
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(snack(tree)?.message).toBe('Added to Up next');
  });
});

describe('Add to setlist from the Stem songs list', () => {
  it('swaps the actions sheet for the setlist picker on this song', async () => {
    const { tree } = openStemRow('present');
    expect(picker(tree).props.visible).toBe(false);
    await press(tree, 'Add to setlist');
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(picker(tree).props).toMatchObject({
      visible: true,
      songTitle: 'Night Bus',
    });
  });

  it('says where the song went, and Open goes to that setlist', async () => {
    const { tree, onOpenSetlist } = openStemRow('present');
    await press(tree, 'Add to setlist');
    act(() => {
      (
        picker(tree).props.onAdded as (added: {
          setlistId: number;
          name: string;
        }) => void
      )({ setlistId: GIG, name: 'Gig' });
    });
    const shownSnack = snack(tree);
    expect(shownSnack?.message).toBe('Added to Gig');
    expect(shownSnack?.action?.label).toBe('Open');
    shownSnack?.action?.onPress();
    expect(onOpenSetlist).toHaveBeenCalledWith(GIG);
  });
});
