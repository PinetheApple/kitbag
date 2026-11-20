import { createPlayQueueRepository } from '@kitbag/core-db/src/play-queue-repository';
import { deleteStemSet } from '@kitbag/core-db/src/stem-bundle-repository';
import { insertStemSet } from '@kitbag/core-db/src/stem-entries.test-helper';
import type { StoreApi } from 'zustand/vanilla';
import { describe, expect, it } from 'vitest';

import { activeSetlistOf, SONG_STEP } from '../library/setlistPosition.ts';
import { createLibraryStore, type LibraryStore } from '../library/store.ts';
import { setup as librarySetup } from '../library/store.test-helper.ts';
import {
  ADVANCE,
  cursorOf,
  entriesAfter,
  onStageOf,
  UP_NEXT_SOURCE,
} from './order.ts';
import { createPlayOrderStore, stageMarkOf } from './store.ts';

const EDITED_BPM = 150;

function orderOn(
  library: StoreApi<LibraryStore>,
  queue: ReturnType<typeof createPlayQueueRepository>,
) {
  const stage = () => onStageOf(library.getState());
  return createPlayOrderStore({
    queue: () => queue,
    stage,
    cursor: () => cursorOf(stage(), library.getState().loaded),
    refreshStage: () => library.getState().refresh(),
    playSetlistEntry: (itemId, setlistId) =>
      library.getState().openStemEntry(itemId, setlistId),
    loadPreset: (presetId, itemId, setlistId) =>
      library.getState().loadSong(presetId, itemId, setlistId),
    markStage: stageMarkOf(library),
  });
}

async function setup() {
  const { library, repos, handle, metronome } = librarySetup();
  const queue = createPlayQueueRepository(handle);
  const order = orderOn(library, queue);
  const gig = await library.getState().createSetlist('Gig');
  const warmUp = await library.getState().newSongFromCurrent('Warm-up', gig);
  const a = await insertStemSet(handle.db, 'A');
  const b = await insertStemSet(handle.db, 'B');
  const first = await repos.setlists.addStemSet(gig, a);
  const second = await repos.setlists.addStemSet(gig, b);
  await library.getState().refresh();
  const [click] = library.getState().entries[gig] ?? [];
  if (click === undefined) throw new Error('missing warm-up entry');
  await library.getState().loadSong(warmUp, click.item.id, gig);
  return {
    library,
    order,
    handle,
    repos,
    metronome,
    queue,
    gig,
    a,
    b,
    first,
    second,
  };
}

async function relaunched(context: Awaited<ReturnType<typeof setup>>) {
  const library = createLibraryStore({
    repos: () => context.repos,
    metronome: () => context.metronome.getState(),
    now: Date.now,
  });
  await library.getState().refresh();
  return { library, order: orderOn(library, context.queue) };
}

function laterFromSetlist(library: StoreApi<LibraryStore>) {
  const stage = onStageOf(library.getState());
  return entriesAfter(stage, cursorOf(stage, library.getState().loaded));
}

describe('the setlist Up next plays from', () => {
  it('is not a setlist pinned in an earlier session, so Next plays only the queue', async () => {
    const context = await setup();
    const { library, order } = await relaunched(context);
    expect(activeSetlistOf(library.getState().setlists)?.setlist.id).toBe(
      context.gig,
    );
    expect(library.getState().session).toBeNull();
    await order.getState().enqueue(context.a);
    expect(laterFromSetlist(library)).toEqual([]);
    expect(order.getState().upNext()).toEqual({
      source: UP_NEXT_SOURCE.queue,
      stemSetId: context.a,
    });
    expect(await order.getState().skipToNext()).toMatchObject({
      advance: { kind: ADVANCE.play, stemSetId: context.a },
    });
    expect(order.getState().upNext()).toBeUndefined();
  });

  it('ends when a song starts from a list, keeping the queued songs', async () => {
    const { library, order, a, b } = await setup();
    await order.getState().enqueue(b);
    expect(laterFromSetlist(library)).toMatchObject([{ stemSetId: a }, {}]);
    library.getState().endSetlistSession();
    expect(laterFromSetlist(library)).toEqual([]);
    expect(order.getState().queue).toMatchObject([{ stemSetId: b }]);
  });

  it('is the setlist started last, replacing the one before it', async () => {
    const { library, repos, handle, gig, first } = await setup();
    const encore = await library.getState().createSetlist('Encore');
    const c = await insertStemSet(handle.db, 'C');
    const d = await insertStemSet(handle.db, 'D');
    const opener = await repos.setlists.addStemSet(encore, c);
    await repos.setlists.addStemSet(encore, d);
    await library.getState().refresh();
    await library.getState().openStemEntry(opener.id, encore);
    expect(laterFromSetlist(library)).toMatchObject([{ stemSetId: d }]);
    await library.getState().openStemEntry(first.id, gig);
    expect(onStageOf(library.getState()).setlistId).toBe(gig);
    expect(library.getState().endedSetlist).toMatchObject({
      setlistId: encore,
      setlistName: 'Encore',
    });
  });

  it('says which setlist a list start ended, and only when one was running', async () => {
    const { library, gig } = await setup();
    library.getState().endSetlistSession();
    expect(library.getState().endedSetlist).toMatchObject({
      setlistId: gig,
      setlistName: 'Gig',
    });
    library.getState().dismissEndedSetlist();
    library.getState().endSetlistSession();
    expect(library.getState().endedSetlist).toBeNull();
  });

  it('keeps the setlist when the list reopens the song playing from it', async () => {
    const { library, gig, a, first } = await setup();
    await library.getState().openStemEntry(first.id, gig);
    library.getState().endSetlistSession(a);
    expect(library.getState().session?.setlistId).toBe(gig);
    expect(library.getState().endedSetlist).toBeNull();
  });

  it('starts a different song from the list even when it is in the setlist', async () => {
    const { library, gig, b, first } = await setup();
    await library.getState().openStemEntry(first.id, gig);
    library.getState().endSetlistSession(b);
    expect(library.getState().session).toBeNull();
  });

  it('skips an entry removed from Up next this time, without editing the setlist', async () => {
    const { library, order, gig, b, first } = await setup();
    library.getState().skipSetlistEntry(first.id);
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: b },
    });
    expect(library.getState().entries[gig]).toHaveLength(3);
  });

  it('is left and unpinned by Leave setlist, and Undo puts both back', async () => {
    const { library, order, gig, a } = await setup();
    const left = await library.getState().leaveSetlist();
    expect(order.getState().upNext()).toBeUndefined();
    expect(activeSetlistOf(library.getState().setlists)).toBeUndefined();
    if (left === null) throw new Error('nothing was left');
    expect(await library.getState().rejoinSetlist(left)).toBe(true);
    expect(activeSetlistOf(library.getState().setlists)?.setlist.id).toBe(gig);
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: a },
    });
  });

  it('does not undo a Leave over a setlist started since', async () => {
    const { library, gig, second } = await setup();
    const left = await library.getState().leaveSetlist();
    if (left === null) throw new Error('nothing was left');
    await library.getState().openStemEntry(second.id, gig);
    const started = library.getState().loaded;
    expect(await library.getState().rejoinSetlist(left)).toBe(false);
    expect(library.getState().loaded).toBe(started);
  });

  it('drops the unsaved-edit undo that Leave noted when Leave is undone', async () => {
    const { library, metronome } = await setup();
    metronome.getState().setTempo(EDITED_BPM);
    const left = await library.getState().leaveSetlist();
    expect(library.getState().discarded).not.toBeNull();
    if (left === null) throw new Error('nothing was left');
    await library.getState().rejoinSetlist(left);
    expect(library.getState().discarded).toBeNull();
  });
});

describe('play order on the library stage', () => {
  it('reads the entry on stage from the library, not a copy of its own', async () => {
    const { library, order, gig, a, b, second } = await setup();
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: a },
    });
    await library.getState().openStemEntry(second.id, gig);
    expect(order.getState().upNext()).toBeUndefined();
    await library.getState().stepSong(SONG_STEP.previous);
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: b },
    });
  });

  it('puts the stem entry it advances to on stage in the library', async () => {
    const { library, order, gig, a, first } = await setup();
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.play,
      stemSetId: a,
    });
    expect(library.getState().loaded).toEqual({
      presetId: null,
      stemSetId: a,
      itemId: first.id,
      setlistId: gig,
      index: 1,
    });
  });

  it('puts the library stage back when a press undoes the step', async () => {
    const { library, order } = await setup();
    const { loaded, played, discarded } = library.getState();
    const step = await order.getState().peekNext();
    const stood = await order.getState().commitNext(step.advance, () => false);
    expect(stood).toBeNull();
    expect(library.getState()).toMatchObject({ loaded, played, discarded });
  });

  it('keeps the stem entry a press opened again during the commit', async () => {
    const { library, order, gig, first } = await setup();
    const step = await order.getState().peekNext();
    const pressOpeningSameEntry = () => {
      void library.getState().openStemEntry(first.id, gig);
      return false;
    };
    await order.getState().commitNext(step.advance, pressOpeningSameEntry);
    expect(library.getState().loaded).toMatchObject({
      presetId: null,
      itemId: first.id,
    });
  });

  it('says a stem song deleted after it was shown as up next was skipped', async () => {
    const { order, handle, a, b } = await setup();
    await deleteStemSet(handle.db, a);
    expect(await order.getState().skipToNext()).toMatchObject({
      advance: { kind: ADVANCE.play, stemSetId: b },
      skipped: true,
    });
  });

  it('does not call an ordinary skip a skipped song', async () => {
    const { order, a } = await setup();
    expect(await order.getState().skipToNext()).toMatchObject({
      advance: { stemSetId: a },
      skipped: false,
    });
  });

  it('carries on with the entry that moved up when the one on stage is removed', async () => {
    const { library, order, gig, b, first } = await setup();
    await library.getState().openStemEntry(first.id, gig);
    await library.getState().removeFromSet(first.id);
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: b },
    });
  });

  it('carries on the same way when the stem song on stage is deleted', async () => {
    const { library, order, handle, gig, a, b, first } = await setup();
    await library.getState().openStemEntry(first.id, gig);
    await deleteStemSet(handle.db, a);
    await library.getState().refresh();
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: b },
    });
  });

  it('ends when the last entry was on stage and is removed', async () => {
    const { library, order, gig, second } = await setup();
    await library.getState().openStemEntry(second.id, gig);
    await library.getState().removeFromSet(second.id);
    expect(await order.getState().advance()).toEqual({ kind: ADVANCE.end });
  });

  it('follows the entry on stage through a reorder before it is removed', async () => {
    const { library, order, gig, b, first } = await setup();
    await library.getState().openStemEntry(first.id, gig);
    await library.getState().reorder(gig, 0, 2);
    await library.getState().removeFromSet(first.id);
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: b },
    });
  });
});

describe('play order after removals around the entry on stage', () => {
  async function fiveStemSongs() {
    const { library, repos, handle } = librarySetup();
    const queue = createPlayQueueRepository(handle);
    const order = orderOn(library, queue);
    const gig = await library.getState().createSetlist('Gig');
    const ids: Record<string, { stemSetId: number; itemId: number }> = {};
    for (const name of ['A', 'B', 'C', 'D', 'E']) {
      const stemSetId = await insertStemSet(handle.db, name);
      const item = await repos.setlists.addStemSet(gig, stemSetId);
      ids[name] = { stemSetId, itemId: item.id };
    }
    await library.getState().refresh();
    const of = (name: string) => {
      const found = ids[name];
      if (found === undefined) throw new Error(`missing ${name}`);
      return found;
    };
    await library.getState().openStemEntry(of('C').itemId, gig);
    const remove = async (...names: string[]) => {
      for (const name of names)
        await library.getState().removeFromSet(of(name).itemId);
    };
    return { order, remove, of };
  }

  it('carries on with the next entry when an earlier one is removed too', async () => {
    const { order, remove, of } = await fiveStemSongs();
    await remove('C', 'A');
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: of('D').stemSetId },
    });
  });

  it('carries on past a later entry removed too', async () => {
    const { order, remove, of } = await fiveStemSongs();
    await remove('C', 'D');
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: of('E').stemSetId },
    });
  });

  it('carries on with the next entry when everything before it is removed', async () => {
    const { order, remove, of } = await fiveStemSongs();
    await remove('C', 'A', 'B');
    expect(order.getState().upNext()).toMatchObject({
      entry: { stemSetId: of('D').stemSetId },
    });
  });
});
