import { describe, expect, it } from 'vitest';

import { CATEGORIES, type Category } from './backup-format';
import { parseBackup } from './backup-parse';
import {
  openBackupDatabase,
  presetValues,
  seed,
  SESSION_START,
  type BackupDatabase,
} from './backup.test-helper';
import { MAX_BEATS, MAX_POLY_BEATS, SOUND_COUNT } from './preset-rules';
import { practiceSessions, tunings } from './schema';

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

async function seedEmptyTuning({ handle }: BackupDatabase) {
  await handle.db.insert(tunings).values({
    name: 'Unstrung',
    notes: new Uint8Array(0),
    uuid: crypto.randomUUID(),
  });
}

const STATES: [string, (database: BackupDatabase) => Promise<unknown>][] = [
  ['empty', () => Promise.resolve()],
  ['seeded', seed],
  ['odd accent lengths', seedOddPresets],
  ['two sessions in one second', seedSameSecondSessions],
  ['a tuning with no strings', seedEmptyTuning],
];

const SUBSETS: Category[][] = Array.from(
  { length: 2 ** CATEGORIES.length - 1 },
  (_, mask) => CATEGORIES.filter((_category, bit) => ((mask + 1) >> bit) & 1),
);

describe('export is always importable', () => {
  it.each(STATES)(
    '%s: every category subset parses and plans',
    async (_name, prepare) => {
      const source = openBackupDatabase();
      await prepare(source);
      for (const subset of SUBSETS) {
        const text = await source.backup.export(subset);
        const file = parseBackup(text);
        const plan = await openBackupDatabase().backup.plan(text, {
          categories: file.categories,
        });
        expect(plan.ok, subset.join('+')).toBe(true);
      }
    },
  );

  it('exporting setlists carries the presets they list', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = parseBackup(await source.backup.export(['setlists']));
    expect(file.categories).toEqual(['songPresets', 'setlists']);
    expect(file.records.songPresets).toHaveLength(2);
  });
  it('round-trips a tuning with no strings unchanged', async () => {
    const source = openBackupDatabase();
    await seedEmptyTuning(source);
    const target = openBackupDatabase();
    const plan = await target.backup.plan(await source.backup.export());
    if (!plan.ok) throw new Error(plan.error.kind);
    expect((await target.backup.apply(plan.value)).ok).toBe(true);
    const [tuning] = await target.handle.db.select().from(tunings);
    expect(tuning?.notes).toEqual(new Uint8Array(0));
  });
});
