import { describe, expect, it } from 'vitest';

import { CATEGORIES, type ImportMode } from './backup-format';
import { parseBackup } from './backup-parse';
import {
  openBackupDatabase,
  records,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';

const TOOL_DATA_SHAPES: [string, unknown][] = [
  [
    'version 1 records',
    {
      version: 1,
      records: [
        {
          toolId: 'chords',
          key: 'favourites',
          value: '["Am7"]',
          updatedAt: 1764237600,
        },
      ],
    },
  ],
  ['a later version', { version: 99, records: 'opaque' }],
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
  it.each(TOOL_DATA_SHAPES)(
    'parses to the same file as without it, with %s',
    async (_name, toolData) => {
      const { text } = await seededExport();
      expect(parseBackup(withToolData(text, toolData))).toEqual(
        parseBackup(text),
      );
    },
  );

  it.each<ImportMode>(['merge', 'replace'])(
    'restores every category on %s and ignores the key',
    async (mode) => {
      const { source, text } = await seededExport();
      const [, toolData] = TOOL_DATA_SHAPES[0] ?? [];
      const target = openBackupDatabase();
      await restore(target, withToolData(text, toolData), mode);
      expect(await records(target)).toEqual(await records(source));
    },
  );
});
