import {
  openBackupDatabase,
  type BackupDatabase,
} from '@kitbag/core-db/src/backup.test-helper';
import { KB_RESULT, type PickedDocument } from '@kitbag/core-native';
import { vi } from 'vitest';

import { CODES } from '../songLibrary/store.test-helper.ts';
import { createClickSoundLock } from './lock.ts';
import type { ClickSoundDeps } from './runtime.ts';
import { createClickSoundStore } from './store.ts';

export const SOURCE = 'content://picked/rimshot.flac';
export const PREPARED = 'UklGRiQAAAA=';
export const STORED = {
  slot: 0,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Stored',
  fileName: 'stored.wav',
};
export const PICKED: PickedDocument = {
  uri: SOURCE,
  name: 'Rimshot.flac',
  mimeType: 'audio/flac',
};

export function harness(database: BackupDatabase = openBackupDatabase()) {
  const { files, stored } = database.clickSoundFiles;
  let names = 0;
  let uuids = 0;
  const deps = {
    repository: () => database.clickSounds,
    prepare: vi.fn<ClickSoundDeps['prepare']>(async (_uri, fileName) => {
      await files.write(fileName, PREPARED);
      return KB_RESULT.KB_OK;
    }),
    load: vi.fn<ClickSoundDeps['load']>(() => Promise.resolve(KB_RESULT.KB_OK)),
    clear: vi.fn(),
    deleteFile: vi.fn((fileName: string) => files.remove(fileName)),
    newUuid: () =>
      `00000000-0000-4000-8000-${String(++uuids).padStart(12, '0')}`,
    freshFileName: () => `file-${String(++names)}.wav`,
    afterRemove: vi.fn(() => Promise.resolve()),
    pickDocument: vi.fn<ClickSoundDeps['pickDocument']>(() =>
      Promise.resolve(PICKED),
    ),
    sniffUnsupportedFormat: vi.fn<ClickSoundDeps['sniffUnsupportedFormat']>(
      () => Promise.resolve(''),
    ),
    constants: () => CODES,
    listFiles: vi.fn(() => Promise.resolve([...stored.keys()])),
    clearPartials: vi.fn(() => Promise.resolve()),
  } satisfies ClickSoundDeps;
  const lock = createClickSoundLock();
  const store = createClickSoundStore(() => deps, lock);
  return {
    database,
    deps,
    stored,
    store,
    lock,
    state: () => store.getState(),
  };
}
