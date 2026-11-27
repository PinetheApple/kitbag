import {
  openBackupDatabase,
  seed,
} from '@kitbag/core-db/src/backup.test-helper';
import { customSoundId, KB_DEFAULT_SOUNDS } from '@kitbag/core-native';
import { beforeEach, expect, it, vi } from 'vitest';

import { createRestoreStore } from '../backup/restore.ts';
import type { BackupDeps } from '../backup/runtime.ts';
import {
  LIBRARY_BACKUP_FILE_NAME,
  shareLibraryBackup,
} from '../backup/share.ts';
import { stubMetronomeRuntime } from './runtime.test-helper.ts';
import type { MetronomeSettingsInput } from './standalone.ts';
import {
  configureStandaloneMetronomePersistence,
  flushStandaloneMetronomePersistence,
  releaseStandaloneSound,
  reloadStandaloneMetronomePersistence,
  STANDALONE_METRONOME_SAVE_DELAY_MS,
} from './standalonePersistence.ts';
import { metronomeStore } from './store.ts';

const STORED_BPM = 110;
const EDITED_BPM = 128;
const RESTORED_BPM = 140;
const BUILT_IN = 2;
const REMOVED = customSoundId(0);

stubMetronomeRuntime(STORED_BPM);

let stored: Partial<MetronomeSettingsInput> = { bpm: STORED_BPM };
configureStandaloneMetronomePersistence({
  load: () => stored,
  save: (settings) => {
    stored = settings;
  },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

let editedBpm = EDITED_BPM;

async function editTempo() {
  editedBpm += 1;
  metronomeStore.getState().setTempo(editedBpm);
  await Promise.resolve();
  return editedBpm;
}

function backupDeps(target = openBackupDatabase()) {
  const contents = JSON.stringify({});
  const deps: BackupDeps = {
    service: () => target.backup,
    pick: () =>
      Promise.resolve({
        name: LIBRARY_BACKUP_FILE_NAME,
        bytes: contents.length,
        contents,
      }),
    share: () => Promise.resolve(),
    save: () => Promise.resolve(true),
    afterRestore: () => Promise.resolve(),
  };
  return { deps, target };
}

it('writes the pending standalone settings when flushed', async () => {
  const bpm = await editTempo();
  expect(stored.bpm).not.toBe(bpm);

  flushStandaloneMetronomePersistence();

  expect(stored.bpm).toBe(bpm);
});

it('writes the pending standalone settings before a backup is exported', async () => {
  const { deps, target } = backupDeps();
  let exportedBpm: number | undefined;
  vi.spyOn(target.backup, 'export').mockImplementation(() => {
    exportedBpm = stored.bpm;
    return Promise.resolve('{}');
  });
  const bpm = await editTempo();

  await shareLibraryBackup(deps);

  expect(exportedBpm).toBe(bpm);
});

it('writes the pending standalone settings before a backup is applied', async () => {
  const source = openBackupDatabase();
  await seed(source);
  const contents = await source.backup.export();
  const { deps, target } = backupDeps();
  const pick = () =>
    Promise.resolve({
      name: LIBRARY_BACKUP_FILE_NAME,
      bytes: contents.length,
      contents,
    });
  let appliedOverBpm: number | undefined;
  const apply = target.backup.apply.bind(target.backup);
  vi.spyOn(target.backup, 'apply').mockImplementation((...args) => {
    appliedOverBpm = stored.bpm;
    return apply(...args);
  });
  const restore = createRestoreStore(() => ({ ...deps, pick }));
  await restore.getState().pick();
  const bpm = await editTempo();

  await restore.getState().apply();

  expect(appliedOverBpm).toBe(bpm);
});

it('drops a pending write a restore replaced, keeping the restored settings', async () => {
  await editTempo();
  stored = { bpm: RESTORED_BPM };

  reloadStandaloneMetronomePersistence();
  vi.advanceTimersByTime(STANDALONE_METRONOME_SAVE_DELAY_MS);

  expect(stored.bpm).toBe(RESTORED_BPM);
  expect(metronomeStore.getState().bpm).toBe(RESTORED_BPM);
});

it('releases a sound over the latest standalone settings', async () => {
  metronomeStore.getState().setSounds(BUILT_IN, REMOVED);
  const bpm = await editTempo();

  releaseStandaloneSound(REMOVED);
  vi.advanceTimersByTime(STANDALONE_METRONOME_SAVE_DELAY_MS);

  expect(stored.bpm).toBe(bpm);
  expect(stored.sounds).toEqual({
    normal: BUILT_IN,
    accent: KB_DEFAULT_SOUNDS.accent,
  });
});
