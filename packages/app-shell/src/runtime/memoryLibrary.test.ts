import { describe, expect, it } from 'vitest';

import { createMemoryLibrary, type TextStorage } from './memoryLibrary.ts';

function memoryStorage(): TextStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const PRESET = {
  bpm: 120,
  beatsPerBar: 4,
  subdivision: 1,
  accents: Uint8Array.from([3, 1, 1, 1]) as unknown as Buffer,
  polyEnabled: false,
  polyBeats: 0,
  sound: 0,
};

async function fixture(storage?: TextStorage) {
  const repos = createMemoryLibrary(storage);
  const set = await repos.setlists.create('Gig');
  const other = await repos.setlists.create('Other');
  const ids: number[] = [];
  for (const name of ['A', 'B', 'C']) {
    const preset = await repos.presets.create({ ...PRESET, name });
    await repos.setlists.add(set.id, preset.id);
    ids.push(preset.id);
  }
  return { repos, set, other, ids };
}

async function names(
  repos: ReturnType<typeof createMemoryLibrary>,
  setlistId: number,
) {
  const presets = await repos.presets.list();
  const items = await repos.setlists.items(setlistId);
  return items.map(
    (item) => presets.find((p) => p.id === item.songPresetId)?.name,
  );
}

describe('memory library repositories', () => {
  it('reorders within a set and moves across sets, renumbering both', async () => {
    const { repos, set, other } = await fixture();
    const [a] = await repos.setlists.items(set.id);
    if (a === undefined) throw new Error('missing item');
    await repos.setlists.move(a.id, 2);
    expect(await names(repos, set.id)).toEqual(['B', 'C', 'A']);
    await repos.setlists.moveTo(a.id, other.id);
    expect(await names(repos, set.id)).toEqual(['B', 'C']);
    expect((await repos.setlists.items(set.id)).map((i) => i.position)).toEqual(
      [0, 1],
    );
    expect(await names(repos, other.id)).toEqual(['A']);
  });

  it('duplicates a set and deletes a preset from every set', async () => {
    const { repos, set, ids } = await fixture();
    const copy = await repos.setlists.duplicate(set.id, 'Gig copy');
    await repos.presets.delete(ids[1] ?? 0);
    expect(await names(repos, set.id)).toEqual(['A', 'C']);
    expect(await names(repos, copy.id)).toEqual(['A', 'C']);
  });

  it('matches % and _ literally, case-insensitively', async () => {
    const repos = createMemoryLibrary();
    await repos.setlists.create('100% Rock');
    await repos.setlists.create('1000 rock');
    await repos.presets.create({ ...PRESET, name: 'a_b' });
    await repos.presets.create({ ...PRESET, name: 'axb' });
    expect((await repos.setlists.search('0% r')).map((s) => s.name)).toEqual([
      '100% Rock',
    ]);
    expect((await repos.presets.search('_')).map((p) => p.name)).toEqual([
      'a_b',
    ]);
  });

  it('keeps one active set', async () => {
    const { repos, set, other } = await fixture();
    await repos.setlists.selectActive(set.id);
    await repos.setlists.selectActive(other.id);
    expect(
      (await repos.setlists.list()).filter((s) => s.active).map((s) => s.id),
    ).toEqual([other.id]);
  });

  it('survives a reload through storage, blobs included', async () => {
    const storage = memoryStorage();
    const { set } = await fixture(storage);
    const reloaded = createMemoryLibrary(storage);
    expect(await names(reloaded, set.id)).toEqual(['A', 'B', 'C']);
    const [preset] = await reloaded.presets.list();
    expect(Array.from(preset?.accents ?? [])).toEqual([3, 1, 1, 1]);
    const next = await reloaded.setlists.create('After reload');
    expect(next.id).toBeGreaterThan(set.id);
  });
});
