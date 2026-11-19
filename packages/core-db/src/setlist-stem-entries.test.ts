import { afterEach, describe, expect, it } from 'vitest';

import { createSetlistRepository } from './setlist-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { insertStemSet } from './stem-entries.test-helper';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  const sets = createSetlistRepository(handle);
  const preset = await createSongPresetRepository(handle).create({
    name: 'Warm-up',
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    accents: new Uint8Array([2, 1, 1, 1]),
    polyEnabled: false,
    polyBeats: 0,
    sound: 0,
  });
  const redbone = await insertStemSet(handle.db, 'Redbone');
  const juicy = await insertStemSet(handle.db, 'Juicy');
  const gig = await sets.create('Gig');
  const entries = async (setlistId = gig.id) =>
    (await sets.items(setlistId)).map(
      ({ songPresetId, stemSetId }) =>
        songPresetId ?? `stem ${String(stemSetId)}`,
    );
  return { sets, preset, redbone, juicy, gig, entries };
}

describe('stem songs in setlists', () => {
  it('adds stem entries beside metronome entries, at a position', async () => {
    const { sets, preset, redbone, juicy, gig, entries } = await setup();
    await sets.add(gig.id, preset.id);
    await sets.addStemSet(gig.id, redbone);
    const inserted = await sets.addStemSet(gig.id, juicy, 0);
    expect(inserted).toMatchObject({
      stemSetId: juicy,
      songPresetId: null,
      position: 0,
    });
    expect(await entries()).toEqual([
      `stem ${String(juicy)}`,
      preset.id,
      `stem ${String(redbone)}`,
    ]);
  });

  it('lets a setlist repeat a stem song', async () => {
    const { sets, redbone, gig, entries } = await setup();
    await sets.addStemSet(gig.id, redbone);
    await sets.addStemSet(gig.id, redbone);
    expect(await entries()).toEqual([
      `stem ${String(redbone)}`,
      `stem ${String(redbone)}`,
    ]);
  });

  it('reorders and removes a stem entry like any other', async () => {
    const { sets, preset, redbone, juicy, gig, entries } = await setup();
    await sets.add(gig.id, preset.id);
    const moved = await sets.addStemSet(gig.id, redbone);
    const removed = await sets.addStemSet(gig.id, juicy);
    await sets.move(moved.id, 0);
    await sets.removeItem(removed.id);
    expect(await entries()).toEqual([`stem ${String(redbone)}`, preset.id]);
  });

  it('moves a stem entry to another setlist', async () => {
    const { sets, preset, redbone, gig, entries } = await setup();
    const other = await sets.create('Encore');
    await sets.add(other.id, preset.id);
    const item = await sets.addStemSet(gig.id, redbone);
    await sets.moveTo(item.id, other.id, 0);
    expect(await entries()).toEqual([]);
    expect(await entries(other.id)).toEqual([
      `stem ${String(redbone)}`,
      preset.id,
    ]);
  });

  it('copies stem entries when the setlist is duplicated', async () => {
    const { sets, preset, redbone, gig, entries } = await setup();
    await sets.addStemSet(gig.id, redbone);
    await sets.add(gig.id, preset.id);
    const copy = await sets.duplicate(gig.id, 'Gig copy');
    expect(await entries(copy.id)).toEqual(await entries());
  });

  it('refuses a stem song that does not exist', async () => {
    const { sets, gig } = await setup();
    await expect(
      sets.addStemSet(gig.id, Number.MAX_SAFE_INTEGER),
    ).rejects.toHaveProperty(
      'cause.message',
      expect.stringMatching(/FOREIGN KEY/),
    );
  });
});
