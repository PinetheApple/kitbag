import { like, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import type { Transactor } from './transaction';

export type Database = BaseSQLiteDatabase<'async', unknown, typeof schema>;
export type Setlist = typeof schema.setlists.$inferSelect;
export type SetlistItem = typeof schema.setlistItems.$inferSelect;
export type SongPreset = typeof schema.songPresets.$inferSelect;
export type NewSongPreset = Omit<
  typeof schema.songPresets.$inferInsert,
  'uuid'
>;

export interface DatabaseHandle {
  db: Database;
  transactor: Transactor;
}

export function found<T>(rows: T[], label: string): T {
  const [row] = rows;
  if (row === undefined) throw new Error(`${label} not found`);
  return row;
}

export function escapedLike(column: Parameters<typeof like>[0], query: string) {
  const escaped = query.replace(/[\\%_]/g, (character) => `\\${character}`);
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}

// Custom tunings only; built-ins are code constants. `notes` are MIDI note
// numbers, low string first. `instrument` is a KB_TUNER_INSTRUMENT_* value,
// range-checked against the mirror in tuning-rules.ts.
export interface Tuning {
  id: number;
  uuid: string;
  name: string;
  instrument: number;
  notes: number[];
}

export type NewTuning = Omit<Tuning, 'id' | 'uuid'>;

export interface TuningRepository {
  list(): Promise<Tuning[]>;
  create(values: NewTuning): Promise<Tuning>;
  update(id: number, values: Partial<NewTuning>): Promise<void>;
  delete(id: number): Promise<void>;
}
