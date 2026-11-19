import {
  stemDeckStore,
  type StemDeckImportRow,
  type StemDeckImportView,
} from '@kitbag/core-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportProgressScreen } from './ImportProgressScreen.tsx';
import { ImportStatusCard } from './ImportStatusCard.tsx';
import {
  importRow,
  mount,
  resetStemDeck,
} from './stemDeckHarness.test-helper.tsx';

const INSETS = { top: 0, bottom: 0 };
const MB = 1_000_000;
const DOWNLOADED_MB = 38;
const SIZE_MB = 82;
const FREE_MB = 40;
const DOWNLOAD_PERCENT = 46;

function show(
  rows: StemDeckImportRow[],
  change: Partial<StemDeckImportView> = {},
) {
  stemDeckStore.setState({
    importView: {
      origin: null,
      rows,
      added: rows.filter((r) => r.phase === 'added').length,
      running: true,
      finished: false,
      stopped: null,
      retryCount: 0,
      ...change,
    },
  });
}

function progress(onOpenStemSongs = vi.fn(), onBack = vi.fn()) {
  return (
    <ImportProgressScreen
      insets={INSETS}
      onBack={onBack}
      onOpenStemSongs={onOpenStemSongs}
    />
  );
}

beforeEach(() => {
  resetStemDeck();
});

describe('songs coming in', () => {
  it('shows each song’s phase with its badge and the download percentage', async () => {
    show([
      importRow('Goodness of God (Live)', 'added'),
      importRow('Echo', 'skipped'),
      importRow('Graves into Gardens', 'adding'),
      importRow('Way Maker', 'downloading', {
        percent: DOWNLOAD_PERCENT,
        bytesDone: DOWNLOADED_MB * MB,
        bytesTotal: SIZE_MB * MB,
      }),
      importRow('Gratitude', 'preparing'),
      importRow('Holy Forever', 'waiting'),
    ]);
    const screen = await mount(progress());
    expect(screen.has('1 of 6 added')).toBe(true);
    for (const badge of ['ADDED', 'SKIPPED', 'ADDING', 'PREPARING'])
      expect(screen.has(badge)).toBe(true);
    expect(screen.has('Downloading · 38 of 82 MB')).toBe(true);
    expect(screen.has('46%')).toBe(true);
    expect(
      screen.byLabel('Way Maker download').props.accessibilityValue,
    ).toEqual({ min: 0, max: 100, now: DOWNLOAD_PERCENT });
    expect(
      screen.byLabel('Gratitude being prepared').props.accessibilityState,
    ).toEqual({ busy: true });
    expect(screen.has('Waiting')).toBe(true);
    expect(screen.labelled('Stop importing')).toHaveLength(1);
  });

  it('says how much space a song needs and offers to retry the rest', async () => {
    const onBack = vi.fn();
    const { native } = resetStemDeck();
    show(
      [
        importRow('Goodness of God (Live)', 'added'),
        importRow('Way Maker', 'failed', {
          failure: 'noSpace',
          bytesTotal: SIZE_MB * MB,
          bytesFree: FREE_MB * MB,
        }),
        importRow('Gratitude', 'notStarted'),
      ],
      { running: false, stopped: 'noSpace', retryCount: 2 },
    );
    const screen = await mount(progress(vi.fn(), onBack));
    expect(screen.has('Not enough space')).toBe(true);
    expect(
      screen.has(
        'Way Maker needs 82 MB and this phone has 40 MB free. Free some space, then retry.',
      ),
    ).toBe(true);
    expect(screen.has('Needs 82 MB · nothing added')).toBe(true);
    expect(screen.has('FAILED')).toBe(true);
    await screen.press('Retry 2 songs');
    expect(native.retryImport).toHaveBeenCalledOnce();
    await screen.press('Close');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('says the connection was lost and offers to retry the rest', async () => {
    const { native } = resetStemDeck();
    show(
      [
        importRow('Goodness of God (Live)', 'added'),
        importRow('Way Maker', 'failed', {
          failure: 'dropped',
          bytesDone: DOWNLOADED_MB * MB,
          bytesTotal: SIZE_MB * MB,
        }),
        importRow('Gratitude', 'notStarted'),
        importRow('Holy Forever', 'notStarted'),
      ],
      { running: false, stopped: 'dropped', retryCount: 3 },
    );
    const screen = await mount(progress());
    expect(screen.has('Lost the connection to StemDeck')).toBe(true);
    expect(screen.has('Connection lost at 46% · nothing added')).toBe(true);
    expect(screen.texts().filter((t) => t === 'Not started')).toHaveLength(2);
    await screen.press('Retry 3 songs');
    expect(native.retryImport).toHaveBeenCalledOnce();
  });

  it('opens Stem songs when everything is in', async () => {
    const onOpenStemSongs = vi.fn();
    show([importRow('Way Maker', 'added')], {
      running: false,
      finished: true,
    });
    const screen = await mount(progress(onOpenStemSongs));
    expect(screen.has('All done')).toBe(true);
    expect(screen.has('1 song is in Stem songs.')).toBe(true);
    await screen.press('Open Stem songs');
    expect(onOpenStemSongs).toHaveBeenCalledOnce();
  });
});

describe('the import card on Stem songs', () => {
  it('counts what has arrived and opens the progress screen', async () => {
    const onView = vi.fn();
    show([importRow('Way Maker', 'added'), importRow('Gratitude', 'waiting')]);
    const screen = await mount(<ImportStatusCard onView={onView} />);
    expect(screen.has('Getting songs from StemDeck · 1 of 2 added')).toBe(true);
    await screen.press('View the StemDeck import');
    expect(onView).toHaveBeenCalledOnce();
  });

  it('is gone once nothing is running', async () => {
    show([importRow('Way Maker', 'added')], { running: false, finished: true });
    const screen = await mount(<ImportStatusCard onView={vi.fn()} />);
    expect(screen.texts()).toEqual([]);
  });
});
