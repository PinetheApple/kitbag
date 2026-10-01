import { afterEach, describe, expect, it } from 'vitest';

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
  const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map(preset));
  if (!a || !b || !c || !d) throw new Error('fixture presets missing');
  return { sets, presets, a, b, c, d };
}

async function order(
  sets: ReturnType<typeof createSetlistRepository>,
  setlistId: number,
) {
  return (await sets.items(setlistId)).map((item) => [
    item.songPresetId,
    item.position,
  ]);
}

describe('setlist repository', () => {
  it('appends and inserts with dense positions', async () => {
    const { sets, a, b, c } = await setup();
    const setlist = await sets.create('Friday');
    await sets.add(setlist.id, a.id);
    await sets.add(setlist.id, b.id);
    const inserted = await sets.add(setlist.id, c.id, 1);
    expect(inserted.position).toBe(1);
    expect(await order(sets, setlist.id)).toEqual([
      [a.id, 0],
      [c.id, 1],
      [b.id, 2],
    ]);
  });

  it('appends after a deletion gap', async () => {
    const { sets, presets, a, b, c, d } = await setup();
    const setlist = await sets.create('Friday');
    for (const preset of [a, b, c]) await sets.add(setlist.id, preset.id);
    await presets.delete(b.id);
    await sets.add(setlist.id, d.id);
    expect(await order(sets, setlist.id)).toEqual([
      [a.id, 0],
      [c.id, 1],
      [d.id, 2],
    ]);
  });

  it('inserts at an index after a deletion gap', async () => {
    const { sets, presets, a, b, c, d } = await setup();
    const setlist = await sets.create('Friday');
    for (const preset of [a, b, c]) await sets.add(setlist.id, preset.id);
    await presets.delete(b.id);
    await sets.add(setlist.id, d.id, 1);
    expect(await order(sets, setlist.id)).toEqual([
      [a.id, 0],
      [d.id, 1],
      [c.id, 2],
    ]);
  });

  it('moves an item within its setlist', async () => {
    const { sets, a, b, c } = await setup();
    const setlist = await sets.create('Friday');
    await sets.add(setlist.id, a.id);
    await sets.add(setlist.id, b.id);
    const last = await sets.add(setlist.id, c.id);
    await sets.move(last.id, 0);
    expect(await order(sets, setlist.id)).toEqual([
      [c.id, 0],
      [a.id, 1],
      [b.id, 2],
    ]);
  });

  it('moves an item between setlists without touching the preset', async () => {
    const { sets, presets, a, b, c } = await setup();
    const friday = await sets.create('Friday');
    const acoustic = await sets.create('Acoustic');
    const first = await sets.add(friday.id, a.id);
    await sets.add(friday.id, b.id);
    await sets.add(acoustic.id, c.id);
    await sets.moveTo(first.id, acoustic.id, 0);
    expect(await order(sets, friday.id)).toEqual([[b.id, 0]]);
    expect(await order(sets, acoustic.id)).toEqual([
      [a.id, 0],
      [c.id, 1],
    ]);
    expect(await presets.get(a.id)).toEqual(a);
  });

  it('rolls a failed move back without renumbering the source', async () => {
    const { sets, a, b } = await setup();
    const friday = await sets.create('Friday');
    const first = await sets.add(friday.id, a.id);
    await sets.add(friday.id, b.id);
    await expect(sets.moveTo(first.id, friday.id + 99)).rejects.toThrow();
    expect(await order(sets, friday.id)).toEqual([
      [a.id, 0],
      [b.id, 1],
    ]);
  });

  it('removes an item but keeps its preset', async () => {
    const { sets, presets, a } = await setup();
    const setlist = await sets.create('Friday');
    const item = await sets.add(setlist.id, a.id);
    await sets.removeItem(item.id);
    expect(await sets.items(setlist.id)).toEqual([]);
    expect(await presets.get(a.id)).toEqual(a);
  });

  it('lets a preset belong to zero, one or several setlists', async () => {
    const { sets, a, b } = await setup();
    const friday = await sets.create('Friday');
    const acoustic = await sets.create('Acoustic');
    await sets.add(friday.id, a.id);
    await sets.add(acoustic.id, a.id);
    await sets.add(acoustic.id, a.id);
    const all = [
      ...(await sets.items(friday.id)),
      ...(await sets.items(acoustic.id)),
    ];
    expect(all.filter((item) => item.songPresetId === a.id)).toHaveLength(3);
    expect(all.filter((item) => item.songPresetId === b.id)).toHaveLength(0);
  });

  it('keeps exactly one active setlist and can clear it', async () => {
    const { sets } = await setup();
    const friday = await sets.create('Friday');
    const acoustic = await sets.create('Acoustic');
    await sets.selectActive(friday.id);
    await sets.selectActive(acoustic.id);
    expect((await sets.list()).filter((setlist) => setlist.active)).toEqual([
      expect.objectContaining({ id: acoustic.id }),
    ]);
    expect((await sets.active())?.id).toBe(acoustic.id);
    await sets.selectActive(null);
    expect(await sets.active()).toBeUndefined();
  });

  it('rejects an unknown active setlist and keeps the current one', async () => {
    const { sets } = await setup();
    const friday = await sets.create('Friday');
    await sets.selectActive(friday.id);
    await expect(sets.selectActive(friday.id + 99)).rejects.toThrow(
      'not found',
    );
    expect((await sets.active())?.id).toBe(friday.id);
  });

  it('duplicates a setlist with a new identity and the same order', async () => {
    const { sets, presets, a, b, c } = await setup();
    const friday = await sets.create('Friday');
    for (const preset of [a, b, c]) await sets.add(friday.id, preset.id);
    await presets.delete(b.id);
    const copy = await sets.duplicate(friday.id, 'Friday (2)');
    expect(copy.name).toBe('Friday (2)');
    expect(copy.id).not.toBe(friday.id);
    expect(copy.uuid).not.toBe(friday.uuid);
    expect(await order(sets, copy.id)).toEqual([
      [a.id, 0],
      [c.id, 1],
    ]);
    expect(await sets.items(friday.id)).toHaveLength(2);
  });

  it('deletes a setlist and its items but not the presets', async () => {
    const { sets, presets, a } = await setup();
    const friday = await sets.create('Friday');
    await sets.add(friday.id, a.id);
    await sets.delete(friday.id);
    expect(await sets.list()).toEqual([]);
    expect(await sets.items(friday.id)).toEqual([]);
    expect(await presets.get(a.id)).toEqual(a);
  });

  it('searches names literally, without wildcard injection', async () => {
    const { sets } = await setup();
    await sets.create('Friday 100%');
    await sets.create('Friday 1000');
    await sets.create('a_b');
    await sets.create('axb');
    const names = async (query: string) =>
      (await sets.search(query)).map((setlist) => setlist.name);
    expect(await names('100%')).toEqual(['Friday 100%']);
    expect(await names('a_b')).toEqual(['a_b']);
    expect(await names('friday')).toEqual(['Friday 100%', 'Friday 1000']);
    expect(await names('%')).toEqual(['Friday 100%']);
  });
});
