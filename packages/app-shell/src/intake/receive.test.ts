import type { PickedBackup, PickedDocument } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({ useRouter: vi.fn() }));

import { TOOL_ID } from '../home/registry.ts';
import { RESTORE_ROUTE } from '../settings/settingsRoutes.ts';
import { receiveIntake, type IntakeDeps } from './receive.ts';

const JSON_MIME = 'application/json';

const doc = (name: string, mimeType: string): PickedDocument => ({
  uri: `content://shared/${name}`,
  name,
  mimeType,
});

const SONG = doc('Everlong.mp3', 'audio/mpeg');
const SECOND_SONG = doc('Monkey Wrench.wav', 'audio/wav');
const STEMS = doc('Redbone.stemdeck.zip', 'application/zip');
const BACKUP = doc('kitbag_export.json', JSON_MIME);

const BACKUP_FILE: PickedBackup = {
  name: BACKUP.name,
  bytes: 2,
  contents: '{}',
};

function harness(off: readonly string[] = []) {
  const deps = {
    backupMimeType: () => JSON_MIME,
    isOn: (toolId: string) => !off.includes(toolId),
    navigate: vi.fn<IntakeDeps['navigate']>(),
    notify: vi.fn<IntakeDeps['notify']>(),
    importDocuments: vi.fn<IntakeDeps['importDocuments']>(() =>
      Promise.resolve(),
    ),
    openBackup: vi.fn<IntakeDeps['openBackup']>(async (read) => {
      await read();
      return true;
    }),
    readBackup: vi.fn<IntakeDeps['readBackup']>(() =>
      Promise.resolve(BACKUP_FILE),
    ),
  };
  return deps;
}

describe('receiving opened or shared files', () => {
  it('opens Songs and imports shared audio through the batch import', async () => {
    const deps = harness();
    await receiveIntake([SONG, SECOND_SONG], deps);
    expect(deps.navigate).toHaveBeenCalledWith('/library');
    expect(deps.importDocuments).toHaveBeenCalledWith([SONG, SECOND_SONG]);
    expect(deps.openBackup).not.toHaveBeenCalled();
  });

  it('opens Stem songs for a shared StemDeck bundle', async () => {
    const deps = harness();
    await receiveIntake([STEMS], deps);
    expect(deps.navigate).toHaveBeenCalledWith('/stems');
    expect(deps.importDocuments).toHaveBeenCalledWith([STEMS]);
  });

  it('opens Songs for a bundle shared with audio, where both land', async () => {
    const deps = harness();
    await receiveIntake([STEMS, SONG], deps);
    expect(deps.navigate).toHaveBeenCalledWith('/library');
    expect(deps.importDocuments).toHaveBeenCalledWith([STEMS, SONG]);
  });

  it('navigates before importing, so prompts and notices show on that screen', async () => {
    const deps = harness();
    const order: string[] = [];
    deps.navigate.mockImplementation(() => order.push('navigate'));
    deps.importDocuments.mockImplementation(() => {
      order.push('import');
      return Promise.resolve();
    });
    await receiveIntake([SONG], deps);
    expect(order).toEqual(['navigate', 'import']);
  });

  it('opens a shared backup in the Restore review and imports nothing', async () => {
    const deps = harness();
    await receiveIntake([BACKUP], deps);
    expect(deps.navigate).toHaveBeenCalledWith(RESTORE_ROUTE);
    expect(deps.readBackup).toHaveBeenCalledWith(BACKUP.uri);
    expect(deps.openBackup).toHaveBeenCalledOnce();
    expect(deps.importDocuments).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('says the files shared beside a backup were not imported', async () => {
    const deps = harness();
    await receiveIntake([SONG, BACKUP, STEMS], deps);
    expect(deps.importDocuments).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledOnce();
    expect(deps.notify.mock.calls[0]?.[0]).toContain('2 files');
  });

  it('says so when a restore is already applying', async () => {
    const deps = harness();
    deps.openBackup.mockResolvedValue(false);
    await receiveIntake([BACKUP], deps);
    expect(deps.notify).toHaveBeenCalledOnce();
  });

  it.each([
    ['Songs', [TOOL_ID.library], [SONG]],
    ['Stem songs', [TOOL_ID.stems], [STEMS]],
    ['Stem songs', [TOOL_ID.stems], [SONG, STEMS]],
  ])(
    'names %s when its tool is off, and imports nothing',
    async (name, off, items) => {
      const deps = harness(off);
      await receiveIntake(items, deps);
      expect(deps.importDocuments).not.toHaveBeenCalled();
      expect(deps.navigate).not.toHaveBeenCalled();
      expect(deps.notify).toHaveBeenCalledOnce();
      expect(deps.notify.mock.calls[0]?.[0]).toContain(name);
    },
  );

  it('opens a backup whatever tools are off', async () => {
    const deps = harness([TOOL_ID.library, TOOL_ID.stems]);
    await receiveIntake([BACKUP], deps);
    expect(deps.openBackup).toHaveBeenCalledOnce();
  });

  it('does nothing for an empty share', async () => {
    const deps = harness();
    await receiveIntake([], deps);
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });
});
