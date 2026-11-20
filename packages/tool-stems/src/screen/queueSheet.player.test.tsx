import {
  configurePlayOrder,
  ENTRY_KIND,
  libraryStore,
  playOrderStore,
  songLibraryStore,
} from '@kitbag/core-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeQueue, GIG, setQueued, stemRow } from './playQueue.test-helper.ts';
import {
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
} from './playerHarness.test-helper.tsx';

const TIN_ROOF = 22;
const TIN_ROOF_ITEM = 32;
const QUEUE_KEY = 'Queue, 1 up next';

configurePlayOrder({ queue: fakeQueue() });

const libraryBefore = libraryStore.getState();

function stemEntryOnStage() {
  const openStemEntry = vi.fn(() => Promise.resolve(true));
  libraryStore.setState({
    session: { setlistId: GIG, skipped: [] },
    setlists: [
      {
        setlist: { id: GIG, name: 'Gig', active: true },
        songCount: 1,
        rampCount: 0,
      },
    ] as never,
    entries: {
      [GIG]: [
        {
          kind: ENTRY_KIND.stem,
          item: { id: TIN_ROOF_ITEM },
          stemSetId: TIN_ROOF,
        },
      ] as never,
    },
    refresh: () => Promise.resolve(),
    openStemEntry,
  });
  return openStemEntry;
}

beforeEach(() => {
  setQueued([]);
  songLibraryStore.setState({ rows: [stemRow(TIN_ROOF, 'Tin Roof')] });
});

afterEach(() => {
  unmountTracked();
  libraryStore.setState(libraryBefore, true);
});

describe('a setlist row in the player queue sheet', () => {
  it('plays the stem song now and follows it once the sheet has closed', async () => {
    const openStemEntry = stemEntryOnStage();
    const p = await mountTracked();
    await playOrderStore.getState().refresh();
    await flush();
    await p.press(QUEUE_KEY);
    await p.press('Tin Roof, from Gig');
    await flush();
    p.frames(0, 4);
    await flush();
    expect(openStemEntry).toHaveBeenCalledWith(TIN_ROOF_ITEM, GIG);
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(TIN_ROOF);
    await p.showSet(TIN_ROOF);
    expect(p.store.getState().setId).toBe(TIN_ROOF);
    expect(p.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(
      (p.records.readStemSet.mock.calls as unknown[][]).map((call) => call[0]),
    ).toEqual([SET_ID, TIN_ROOF]);
  });
});
