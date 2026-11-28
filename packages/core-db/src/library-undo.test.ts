import { afterEach, describe, expect, it } from 'vitest';

import { createPracticeRepository } from './practice-repository';
import { createSetlistRepository } from './setlist-repository';
import { createSongPresetRepository } from './song-preset-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  const sets = createSetlistRepository(handle);
  const presets = createSongPresetRepository(handle);
  const practice = createPracticeRepository(handle);
  const preset = (name: string) =>
    presets.create({
      name,
      bpm: 120,
      beatsPerBar: 4,
      subdivision: 1,
      accents: new Uint8Array([2, 1, 1, 1]),
      polyEnabled: false,
      polyBeats: 0,
      sound: 0,
    });
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(preset));
  if (!a || !b || !c) throw new Error('fixture presets missing');
  return { sets, presets, practice, a, b, c };
}

type Sets = ReturnType<typeof createSetlistRepository>;

async function order(sets: Sets, setlistId: number) {
  return (await sets.items(setlistId)).map((item) => item.songPresetId);
}

describe('undoing a setlist delete', () => {
  it('puts the setlist back with its id, place and every entry in order', async () => {
    const { sets, a, b, c } = await setup();
    const first = await sets.create('First');
    const gig = await sets.create('Gig');
    await sets.create('Last');
    for (const preset of [c, a, b]) await sets.add(gig.id, preset.id);
    await sets.selectActive(gig.id);
    const deleted = await sets.delete(gig.id);
    if (deleted === undefined) throw new Error('setlist not deleted');
    expect(await sets.items(gig.id)).toEqual([]);
    await sets.restore(deleted);
    const names = (await sets.list()).map((setlist) => setlist.name);
    expect(names).toEqual(['First', 'Gig', 'Last']);
    expect(await order(sets, gig.id)).toEqual([c.id, a.id, b.id]);
    expect((await sets.active())?.id).toBe(gig.id);
    expect(first.id).toBeLessThan(gig.id);
  });

  it('links its practice sessions back to it', async () => {
    const { sets, practice } = await setup();
    const gig = await sets.create('Gig');
    await practice.insert({
      uuid: 'session',
      startedAt: new Date(0),
      durationSeconds: 60,
      avgBpm: 100,
      setlistId: gig.id,
      setlistName: 'Gig',
      songUuids: [],
      log: null,
    });
    const deleted = await sets.delete(gig.id);
    if (deleted === undefined) throw new Error('setlist not deleted');
    expect((await practice.list())[0]?.setlistId).toBeNull();
    await sets.restore(deleted);
    expect((await practice.list())[0]?.setlistId).toBe(gig.id);
  });

  it('leaves out an entry whose song was deleted in the meantime', async () => {
    const { sets, presets, a, b } = await setup();
    const gig = await sets.create('Gig');
    for (const preset of [a, b]) await sets.add(gig.id, preset.id);
    const deleted = await sets.delete(gig.id);
    if (deleted === undefined) throw new Error('setlist not deleted');
    await presets.delete(a.id);
    await sets.restore(deleted);
    expect(await order(sets, gig.id)).toEqual([b.id]);
  });
});

describe('undoing Remove from set', () => {
  it('puts the entry back at its place with the same id', async () => {
    const { sets, presets, a, b, c } = await setup();
    const gig = await sets.create('Gig');
    const extra = await presets.duplicate(a.id, 'A2');
    const items = [];
    for (const preset of [a, extra, b, c])
      items.push(await sets.add(gig.id, preset.id));
    await presets.delete(extra.id);
    const [, , target] = items;
    if (target === undefined) throw new Error('fixture item missing');
    const removed = await sets.removeItem(target.id);
    if (removed === undefined) throw new Error('item not removed');
    expect(removed.index).toBe(1);
    expect(await sets.restoreItem(removed)).toBe(true);
    const restored = await sets.items(gig.id);
    expect(restored.map((item) => item.songPresetId)).toEqual([
      a.id,
      b.id,
      c.id,
    ]);
    expect(restored[1]?.id).toBe(target.id);
  });

  it('refuses when the setlist is gone', async () => {
    const { sets, a } = await setup();
    const gig = await sets.create('Gig');
    const item = await sets.add(gig.id, a.id);
    const removed = await sets.removeItem(item.id);
    if (removed === undefined) throw new Error('item not removed');
    await sets.delete(gig.id);
    expect(await sets.restoreItem(removed)).toBe(false);
  });
});

describe('undoing a song delete', () => {
  it('puts the song back, with its identity, in every setlist at the same places', async () => {
    const { sets, presets, a, b, c } = await setup();
    const gig = await sets.create('Gig');
    const acoustic = await sets.create('Acoustic');
    for (const preset of [b, a, c]) await sets.add(gig.id, preset.id);
    for (const preset of [a, b, a]) await sets.add(acoustic.id, preset.id);
    const deleted = await presets.delete(a.id);
    if (deleted === undefined) throw new Error('preset not deleted');
    expect(await presets.get(a.id)).toBeUndefined();
    expect(await order(sets, acoustic.id)).toEqual([b.id]);
    await presets.restore(deleted);
    expect(await presets.get(a.id)).toEqual(a);
    expect(await order(sets, gig.id)).toEqual([b.id, a.id, c.id]);
    expect(await order(sets, acoustic.id)).toEqual([a.id, b.id, a.id]);
  });
});
