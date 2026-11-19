import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { insertStemSet } from '@kitbag/core-db/src/stem-entries.test-helper';
import { afterEach, describe, expect, it } from 'vitest';

import { ENTRY_KIND, takeSnapshot } from './snapshot.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

async function mixedSetlist() {
  const handle = openTestDatabase();
  handles.push(handle);
  const repos = {
    setlists: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
  };
  const preset = await repos.presets.create({
    name: 'Warm-up',
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    accents: new Uint8Array([2, 1, 1, 1]),
    polyEnabled: false,
    polyBeats: 0,
    sound: 0,
    rampEnabled: true,
  });
  const stemSetId = await insertStemSet(handle.db, 'Redbone');
  const gig = await repos.setlists.create('Gig');
  await repos.setlists.add(gig.id, preset.id);
  await repos.setlists.addStemSet(gig.id, stemSetId);
  return { repos, preset, stemSetId, gig };
}

describe('library snapshot', () => {
  it('keeps a stem entry beside a metronome entry, in order', async () => {
    const { repos, preset, stemSetId, gig } = await mixedSetlist();
    const snapshot = await takeSnapshot(repos);
    expect(
      snapshot.entries[gig.id]?.map((entry) =>
        entry.kind === ENTRY_KIND.stem ? entry.stemSetId : entry.preset.id,
      ),
    ).toEqual([preset.id, stemSetId]);
    expect(snapshot.entries[gig.id]?.[1]?.kind).toBe(ENTRY_KIND.stem);
  });

  it('counts every entry as a song and ramps only on metronome entries', async () => {
    const { repos } = await mixedSetlist();
    const [summary] = (await takeSnapshot(repos)).setlists;
    expect(summary).toMatchObject({ songCount: 2, rampCount: 1 });
  });

  it('still drops a metronome entry whose song is gone', async () => {
    const { repos, preset, gig } = await mixedSetlist();
    const presets = {
      ...repos.presets,
      list: async () =>
        (await repos.presets.list()).filter((p) => p.id !== preset.id),
    };
    const snapshot = await takeSnapshot({ ...repos, presets });
    expect(snapshot.entries[gig.id]?.map((entry) => entry.kind)).toEqual([
      ENTRY_KIND.stem,
    ]);
  });
});
