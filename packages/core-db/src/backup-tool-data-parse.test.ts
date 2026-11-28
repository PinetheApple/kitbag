import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  TOOL_DATA_CATEGORY,
  type ImportMode,
} from './backup-format';
import { parseBackup } from './backup-parse';
import { TEST_BACKUP_RULES } from './backup-rules.test-helper';
import { TOOL_DATA_SECTION_VERSION } from './backup-tool-data';
import {
  openBackupDatabase,
  records,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';

const VERSION_1_SECTION = {
  version: TOOL_DATA_SECTION_VERSION,
  records: [
    {
      toolId: 'chords',
      key: 'favourites',
      value: '["Am7"]',
      updatedAt: 1764237600,
    },
  ],
};

const LATER_SECTION = {
  version: TOOL_DATA_SECTION_VERSION + 1,
  records: 'opaque',
};

const UNREADABLE_SECTIONS: [string, unknown][] = [
  ['a later version', LATER_SECTION],
  ['not an object', 'opaque'],
];

async function seededExport() {
  const source = openBackupDatabase();
  await seed(source);
  return { source, text: await source.backup.export() };
}

function withToolData(text: string, toolData: unknown) {
  return JSON.stringify({
    ...(JSON.parse(text) as Record<string, unknown>),
    toolData,
  });
}

async function restore(target: BackupDatabase, text: string, mode: ImportMode) {
  const plan = unwrap(
    await target.backup.plan(text, { mode, categories: [...CATEGORIES] }),
  );
  unwrap(await target.backup.apply(plan, { confirmReplace: true }));
}

describe('a backup carrying toolData', () => {
  it('reads version 1 records into the file', async () => {
    const { text } = await seededExport();
    expect(
      parseBackup(withToolData(text, VERSION_1_SECTION), TEST_BACKUP_RULES)
        .toolData,
    ).toEqual(VERSION_1_SECTION);
  });

  it.each(UNREADABLE_SECTIONS)(
    'parses to the same file as without it, with %s',
    async (_name, toolData) => {
      const { text } = await seededExport();
      expect(
        parseBackup(withToolData(text, toolData), TEST_BACKUP_RULES),
      ).toEqual(parseBackup(text, TEST_BACKUP_RULES));
    },
  );

  it.each<ImportMode>(['merge', 'replace'])(
    'restores every category on %s and leaves tool data unselected',
    async (mode) => {
      const { source, text } = await seededExport();
      const target = openBackupDatabase();
      await restore(target, withToolData(text, VERSION_1_SECTION), mode);
      expect(await records(target)).toEqual(await records(source));
    },
  );
});

describe('a backup whose toolData is from a later section version', () => {
  it('does not offer tool data', async () => {
    const { text } = await seededExport();
    const planned = unwrap(
      await openBackupDatabase().backup.plan(withToolData(text, LATER_SECTION)),
    );
    expect(planned.categories).not.toContain(TOOL_DATA_CATEGORY);
  });

  it.each<ImportMode>(['merge', 'replace'])(
    'restores every category on %s',
    async (mode) => {
      const { source, text } = await seededExport();
      const target = openBackupDatabase();
      await restore(target, withToolData(text, LATER_SECTION), mode);
      expect(await records(target)).toEqual(await records(source));
    },
  );
});
