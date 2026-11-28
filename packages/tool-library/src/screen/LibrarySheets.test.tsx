// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type {
  LibraryRow,
  LibrarySongRow,
  QueuedSong,
} from '@kitbag/core-state';
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

const songs = vi.hoisted(() => ({
  deleteRowWithUndo: vi.fn(() => Promise.resolve()),
  undoDeleteSong: vi.fn(() => Promise.resolve()),
  dismissDeletedSong: vi.fn(() => Promise.resolve()),
}));

const queue = vi.hoisted(() => ({
  verbs: {
    playNext: vi.fn<(song: QueuedSong) => Promise<boolean>>(() =>
      Promise.resolve(true),
    ),
    addToQueue: vi.fn<(song: QueuedSong) => Promise<boolean>>(() =>
      Promise.resolve(true),
    ),
  },
  reads: [] as boolean[],
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
    select({ codes: {}, replacePrompt: null, deletedSong: null, ...songs }),
  useQueueRefresh: () => {
    queue.reads.push(true);
  },
  useQueueSong: () => queue.verbs,
  useIsQueued: (song: QueuedSong | null) =>
    song !== null && shown.queue.includes(song.id),
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
        onOpenQueue: null,
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
    expect(actions.buttons).toEqual([
      'Play next',
      'Add to queue',
      'Rename',
      REANALYZE_LABEL,
      'Delete song',
    ]);
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
  readonly onOpenQueue: ReturnType<typeof vi.fn>;
}

function Harness({
  row,
  onOpenSetlist,
  onOpenQueue,
}: {
  readonly row: LibraryRow;
  readonly onOpenSetlist: (setlistId: number) => void;
  readonly onOpenQueue: () => void;
}) {
  const menu = useLibraryMenu();
  const { openActions: open } = menu;
  useEffect(() => {
    open(row);
  }, [open, row]);
  return createElement(LibrarySheets, {
    menu,
    bottomInset: 0,
    onOpenSetlist,
    onOpenQueue,
  });
}

const hum = {
  kind: 'song',
  id: NIGHT_BUS,
  title: 'Hum',
} as LibraryRow;

function openRow(row: LibraryRow, files: unknown, queued: number[]): Library {
  shown.failure = null;
  shown.files = files;
  shown.queue = queued;
  queue.verbs.playNext.mockClear();
  queue.verbs.addToQueue.mockClear();
  queue.reads.length = 0;
  const onOpenSetlist = vi.fn();
  const onOpenQueue = vi.fn();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(Harness, { row, onOpenSetlist, onOpenQueue }));
  });
  if (tree === undefined) throw new Error('not mounted');
  return { tree, onOpenSetlist, onOpenQueue };
}

function openStemRow(files: unknown, queued: number[] = []): Library {
  return openRow(nightBus, files, queued);
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

describe('deleting from the actions sheet', () => {
  it('deletes a song at once, with no confirm', async () => {
    songs.deleteRowWithUndo.mockClear();
    const { tree } = openRow(hum, 'present', []);
    await press(tree, 'Delete song');
    expect(songs.deleteRowWithUndo).toHaveBeenCalledExactlyOnceWith(hum);
    expect(tree.root.findAllByType('Sheet' as never)).toEqual([]);
  });

  it('asks before deleting a stem song', async () => {
    songs.deleteRowWithUndo.mockClear();
    const { tree } = openStemRow('present');
    await press(tree, 'Delete stem song');
    expect(songs.deleteRowWithUndo).not.toHaveBeenCalled();
    expect(button(tree, 'Delete').props.variant).toBe('destructive');
  });
});

describe('the actions sheet of a stem song', () => {
  it('offers Play next, Add to queue and Add to setlist above Rename', () => {
    const { tree } = openStemRow('present');
    expect(sheet(tree).buttons).toEqual([
      'Play next',
      'Add to queue',
      'Add to setlist',
      'Rename',
      'Delete stem song',
    ]);
  });

  it('reads the play queue on both lists', () => {
    openStemRow('present');
    openActions(null, 'present');
    expect(new Set(queue.reads)).toEqual(new Set([true]));
  });

  it('draws the queue buttons as the mockup does: 20 dp icons, left-aligned', () => {
    const { tree } = openStemRow('present');
    for (const label of ['Play next', 'Add to queue', 'Add to setlist'])
      expect(button(tree, label).props).toMatchObject({
        iconSize: 'sheetButton',
        align: 'start',
      });
  });

  it('does not say a song was queued when queueing failed', async () => {
    const { tree } = openStemRow('present');
    queue.verbs.playNext.mockResolvedValueOnce(false);
    await press(tree, 'Play next');
    expect(snack(tree)).toBeUndefined();
  });

  it('offers only Rename while its card is away', () => {
    const { tree } = openStemRow('unavailable');
    expect(sheet(tree).buttons).toEqual(['Rename']);
  });

  it('puts the song first on Play next, closes the sheet and says so', async () => {
    const { tree } = openStemRow('present');
    await press(tree, 'Play next');
    expect(queue.verbs.playNext).toHaveBeenCalledWith(nightBus);
    expect(queue.verbs.addToQueue).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(snack(tree)?.message).toBe('Night Bus plays next');
  });

  it.each(['Play next', 'Add to queue'])(
    'opens the queue from Open on the %s snackbar',
    async (verb) => {
      const { tree, onOpenQueue } = openStemRow('present');
      await press(tree, verb);
      const shownSnack = snack(tree);
      expect(shownSnack?.action?.label).toBe('Open');
      shownSnack?.action?.onPress();
      expect(onOpenQueue).toHaveBeenCalledOnce();
    },
  );

  it('puts the song last on Add to queue and says so', async () => {
    const { tree } = openStemRow('present');
    await press(tree, 'Add to queue');
    expect(queue.verbs.addToQueue).toHaveBeenCalledWith(nightBus);
    expect(queue.verbs.playNext).not.toHaveBeenCalled();
    expect(snack(tree)?.message).toBe('Added to queue: Night Bus');
  });

  it('offers Move to end of queue for a queued song, and says which move happened', async () => {
    const queued = openStemRow('present', [NIGHT_BUS]);
    expect(sheet(queued.tree).buttons.slice(0, 2)).toEqual([
      'Play next',
      'Move to end of queue',
    ]);
    await press(queued.tree, 'Move to end of queue');
    expect(queue.verbs.addToQueue).toHaveBeenCalledWith(nightBus);
    expect(snack(queued.tree)?.message).toBe('Moved to end of queue');
    const again = openStemRow('present', [NIGHT_BUS]);
    await press(again.tree, 'Play next');
    expect(snack(again.tree)?.message).toBe('Moved to play next');
  });
});

describe('the actions sheet of a single song', () => {
  it('offers Play next and Add to queue but no setlist, which holds stem songs', () => {
    const { tree } = openRow(hum, 'present', []);
    expect(sheet(tree).buttons.slice(0, 3)).toEqual([
      'Play next',
      'Add to queue',
      'Rename',
    ]);
  });

  it('queues the single song itself', async () => {
    const { tree } = openRow(hum, 'present', []);
    await press(tree, 'Add to queue');
    expect(queue.verbs.addToQueue).toHaveBeenCalledWith(hum);
    expect(snack(tree)?.message).toBe('Added to queue: Hum');
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
