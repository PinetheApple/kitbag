import { createPlayQueueRepository } from '@kitbag/core-db/src/play-queue-repository';
import { deleteStemSet } from '@kitbag/core-db/src/stem-bundle-repository';
import { insertStemSet } from '@kitbag/core-db/src/stem-entries.test-helper';
import { describe, expect, it } from 'vitest';

import { SONG_STEP } from '../library/setlistPosition.ts';
import { setup as librarySetup } from '../library/store.test-helper.ts';
import { ADVANCE, cursorOf, onStageOf } from './order.ts';
import { createPlayOrderStore, stageMarkOf } from './store.ts';

async function setup() {
  const { library, repos, handle } = librarySetup();
  const queue = createPlayQueueRepository(handle);
  const stage = () => onStageOf(library.getState());
  const order = createPlayOrderStore({
    queue: () => queue,
    stage,
    cursor: () => cursorOf(stage(), library.getState().loaded),
    refreshStage: () => library.getState().refresh(),
    playSetlistEntry: (itemId, setlistId) =>
      library.getState().openStemEntry(itemId, setlistId),
    markStage: stageMarkOf(library),
  });
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
  return { library, order, handle, gig, a, b, first, second };
}

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
    expect(stood).toBe(false);
    expect(library.getState()).toMatchObject({ loaded, played, discarded });
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
    const stage = () => onStageOf(library.getState());
    const order = createPlayOrderStore({
      queue: () => queue,
      stage,
      cursor: () => cursorOf(stage(), library.getState().loaded),
      refreshStage: () => library.getState().refresh(),
      playSetlistEntry: (itemId, setlistId) =>
        library.getState().openStemEntry(itemId, setlistId),
      markStage: stageMarkOf(library),
    });
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
