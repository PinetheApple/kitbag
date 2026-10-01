import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrate } from './migrate';
import { REPAIR_PRESETS } from './preset-repair';
import { presetViolation } from './preset-rules';
import { nodeSqliteDriver } from './sqlite.test-helper';

type Row = Record<string, unknown>;

const VALID: Row = {
  name: 'Valid',
  bpm: 120,
  beats_per_bar: 4,
  subdivision: 1,
  denominator: 4,
  accents: new Uint8Array([2, 1, 1, 1]),
  per_accent_sounds: null,
  poly_accents: null,
  poly_enabled: 0,
  poly_beats: 0,
  sound: 0,
  ramp_start_bpm: null,
  ramp_end_bpm: null,
  ramp_bars: null,
  bar_mute_play_bars: null,
  bar_mute_mute_bars: null,
  uuid: 'u',
};

const BROKEN: Row[] = [
  {
    name: 'poly codes',
    poly_beats: 3,
    poly_accents: new Uint8Array([2, 7, 1]),
  },
  { name: 'sound ids', per_accent_sounds: new Uint8Array([1, 6]) },
  { name: 'denominator', denominator: 3 },
  { name: 'subdivision', subdivision: 40 },
  { name: 'ramp', ramp_start_bpm: 5, ramp_end_bpm: 900, ramp_bars: 500 },
  { name: 'mute', bar_mute_play_bars: 0, bar_mute_mute_bars: 99 },
  { name: 'accent codes', accents: new Uint8Array([2, 9, 1, 1]) },
];

function insert(db: DatabaseSync, row: Row) {
  const columns = Object.keys(row);
  db.prepare(
    `INSERT INTO song_presets (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
  ).run(...(Object.values(row) as (string | number | Uint8Array | null)[]));
}

function shape(row: Row) {
  const nullable = (key: string) => row[key] as number | null;
  return {
    bpm: row.bpm as number,
    beatsPerBar: row.beats_per_bar as number,
    subdivision: row.subdivision as number,
    denominator: row.denominator as number,
    sound: row.sound as number,
    polyBeats: row.poly_beats as number,
    rampStartBpm: nullable('ramp_start_bpm'),
    rampEndBpm: nullable('ramp_end_bpm'),
    rampBars: nullable('ramp_bars'),
    barMutePlayBars: nullable('bar_mute_play_bars'),
    barMuteMuteBars: nullable('bar_mute_mute_bars'),
    accents: row.accents as Uint8Array,
    perAccentSounds: row.per_accent_sounds as Uint8Array | null,
    polyAccents: row.poly_accents as Uint8Array | null,
  };
}

function repaired(): Row[] {
  const db = new DatabaseSync(':memory:');
  migrate(nodeSqliteDriver(db));
  for (const change of BROKEN) insert(db, { ...VALID, ...change });
  for (const statement of REPAIR_PRESETS) db.exec(statement);
  return db.prepare('SELECT * FROM song_presets ORDER BY id').all();
}

describe('v9 preset repair', () => {
  it('leaves every migrated preset valid under the preset rules', () => {
    const rows = repaired();
    expect(rows).toHaveLength(BROKEN.length);
    for (const row of rows)
      expect(presetViolation(shape(row)), String(row.name)).toBeUndefined();
  });

  it('keeps meaning where it can: unknown codes read as normal', () => {
    const [poly, sounds, denominator] = repaired();
    expect(poly?.poly_accents).toEqual(new Uint8Array([2, 1, 1]));
    expect(sounds?.per_accent_sounds).toBeNull();
    expect(denominator?.denominator).toBe(4);
  });

  it('clamps trainer settings to engine bounds', () => {
    const rows = repaired();
    const byName = (name: string) => rows.find((row) => row.name === name);
    expect(byName('ramp')).toMatchObject({
      ramp_start_bpm: 20,
      ramp_end_bpm: 400,
      ramp_bars: 64,
    });
    expect(byName('mute')).toMatchObject({
      bar_mute_play_bars: 1,
      bar_mute_mute_bars: 16,
    });
    expect(byName('subdivision')?.subdivision).toBe(16);
  });
});
