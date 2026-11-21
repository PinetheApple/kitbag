import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CATEGORIES, type Category } from './backup-format';
import { parseBackup } from './backup-parse';
import {
  backupDatabase,
  openBackupDatabase,
  presetValues,
  seed,
  SESSION_START,
  type BackupDatabase,
} from './backup.test-helper';
import { MAX_BEATS, MAX_POLY_BEATS, SOUND_COUNT } from './preset-rules';
import { practiceSessions } from './schema';
import { openTestDatabase } from './sqlite.test-helper';

const PRESET_COUNT = 12;
const SPLIT_SECOND_MS = 400;

function random(seed: number) {
  let state = seed;
  return (below: number) => {
    state = (state * 48271) % 2147483647;
    return state % below;
  };
}

function bytes(next: (below: number) => number, length: number, limit: number) {
  return Uint8Array.from(Array.from({ length }, () => next(limit)));
}

async function seedOddPresets({ presets, sets }: BackupDatabase) {
  const next = random(7);
  const setlist = await sets.create('Odd');
  for (let index = 0; index < PRESET_COUNT; index += 1) {
    const beatsPerBar = 1 + next(MAX_BEATS);
    const polyBeats = next(MAX_POLY_BEATS + 1);
    const preset = await presets.create({
      ...presetValues(`Odd ${String(index)}`, null),
      beatsPerBar,
      polyBeats,
      accents: bytes(next, beatsPerBar, 3),
      polyAccents: next(2) ? bytes(next, polyBeats, 3) : null,
      perAccentSounds:
        [null, new Uint8Array(0), bytes(next, 2, SOUND_COUNT)][next(3)] ?? null,
    });
    await sets.add(setlist.id, preset.id);
    await sets.add(setlist.id, preset.id);
  }
}

async function seedSameSecondSessions({ handle }: BackupDatabase) {
  const later = new Date(SESSION_START.getTime() + SPLIT_SECOND_MS);
  await handle.db.insert(practiceSessions).values(
    [SESSION_START, later].map((startTime) => ({
      startTime,
      durationSeconds: 60,
      avgBpm: 100,
      setlistId: null,
      songsPlayed: null,
      uuid: crypto.randomUUID(),
    })),
  );
}

const STATES: [string, (database: BackupDatabase) => Promise<unknown>][] = [
  ['empty', () => Promise.resolve()],
  ['seeded', seed],
  ['odd accent lengths', seedOddPresets],
  ['two sessions in one second', seedSameSecondSessions],
];

const SUBSETS: [string, Category[]][] = Array.from(
  { length: 2 ** CATEGORIES.length - 1 },
  (_, mask) => {
    const subset = CATEGORIES.filter(
      (_category, bit) => ((mask + 1) >> bit) & 1,
    );
    return [subset.join('+'), subset];
  },
);

const EMPTY_COUNTS = Object.fromEntries(
  CATEGORIES.map((category) => [category, 0]),
);

describe('export is always importable', () => {
  describe.each(STATES)('%s', (_name, prepare) => {
    let source: BackupDatabase | undefined;
    let target: BackupDatabase | undefined;

    function prepared() {
      if (source === undefined || target === undefined)
        throw new Error('state databases not open');
      return { source, target };
    }

    beforeAll(async () => {
      source = backupDatabase(openTestDatabase());
      target = backupDatabase(openTestDatabase());
      await prepare(source);
    });

    afterAll(async () => {
      const counts = await target?.backup.summary();
      source?.handle.connection.close();
      target?.handle.connection.close();
      if (counts !== undefined) expect(counts).toEqual(EMPTY_COUNTS);
    });

    it.each(SUBSETS)('%s parses and plans', async (_label, subset) => {
      const { source, target } = prepared();
      const text = await source.backup.export(subset);
      const file = parseBackup(text);
      const plan = await target.backup.plan(text, {
        categories: file.categories,
      });
      expect(plan.ok).toBe(true);
    });
  });

  it('exporting setlists carries the presets they list', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = parseBackup(await source.backup.export(['setlists']));
    expect(file.categories).toEqual(['songPresets', 'setlists']);
    expect(file.records.songPresets).toHaveLength(2);
  });
});
