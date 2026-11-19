import { expect } from 'vitest';

import { unwrap } from './backup.test-helper';
import type { ImportOptions } from './backup-plan';
import {
  addFolderSong,
  addStemDeckSong,
  edit,
  EDITED_MIX,
  expectedEdits,
  FOLDER_UUID,
  JOB,
  LOCAL_SPEED,
  mixOf,
  setSpeed,
  stemSongDatabase,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';
import { CLICK_RATE } from './click-rate';

export const STEMDECK_KEY = `stemdeck:${JOB}`;
export const FOLDER_KEY = `folder:${FOLDER_UUID}`;

export const THEIRS = {
  stemSongs: { [STEMDECK_KEY]: 'theirs', [FOLDER_KEY]: 'theirs' },
} as const;

export interface ExportedFile {
  categories: string[];
  stemSongs?: Record<string, unknown>[];
}

export async function editedBackup() {
  const source = stemSongDatabase();
  await edit(source, await addStemDeckSong(source));
  await edit(source, await addFolderSong(source));
  return JSON.parse(await source.backup.export()) as ExportedFile;
}

export async function freshTarget() {
  const target = stemSongDatabase();
  const stemdeck = await addStemDeckSong(target);
  const folder = await addFolderSong(target);
  return { target, stemdeck, folder };
}

export async function editedTarget() {
  const fresh = await freshTarget();
  await setSpeed(fresh.target, fresh.stemdeck, LOCAL_SPEED);
  await setSpeed(fresh.target, fresh.folder, LOCAL_SPEED);
  return fresh;
}

export async function planFor(
  target: StemSongDatabase,
  file: ExportedFile,
  options: ImportOptions = {},
) {
  return unwrap(await target.backup.plan(JSON.stringify(file), options));
}

export async function restore(
  target: StemSongDatabase,
  file: ExportedFile,
  options: ImportOptions = {},
) {
  const plan = await planFor(target, file, options);
  return target.backup.apply(plan, { confirmReplace: true });
}

export async function expectEdited(target: StemSongDatabase, id: number) {
  const set = await target.library.readStemSet(id);
  expect(set).toMatchObject(expectedEdits);
  expect(mixOf(set)).toEqual(EDITED_MIX);
}

export async function expectUntouched(
  target: StemSongDatabase,
  id: number,
  speed = 1,
) {
  const set = await target.library.readStemSet(id);
  expect(set).toMatchObject({
    title: 'Echo',
    speed,
    meterBeatsPerBar: null,
    lyricsRetimed: null,
    clickRate: CLICK_RATE.single,
    chosenTempoMode: null,
  });
  expect(mixOf(set)?.map(({ volume }) => volume)).toEqual([1, 1]);
}
