import { describe, expect, it } from 'vitest';

import { BACKUP_VERSION, CATEGORIES } from './backup-format';
import { parseBackup } from './backup-parse';
import { openBackupDatabase, seed, unwrap } from './backup.test-helper';
import { TOOL_DATA_SECTION_VERSION } from './backup-tool-data';
import { createToolDataRepository } from './tool-data-repository';
import { MS_PER_SECOND } from './units';

const SAVED_AT = new Date('2026-11-27T10:00:00Z');
const SAVED_AT_SECONDS = SAVED_AT.getTime() / MS_PER_SECOND;

async function withToolData() {
  const database = openBackupDatabase();
  const seeded = await seed(database);
  const toolData = createToolDataRepository(database.handle, () => SAVED_AT);
  await toolData.forTool('drone').set('note', '{"pitch":"D"}');
  await toolData.forTool('chords').set('favourites', '["Am7"]');
  return { ...database, ...seeded, toolData };
}

const root = (text: string) => JSON.parse(text) as Record<string, unknown>;

describe('exporting tool data', () => {
  it('writes no toolData key when no tool has data', async () => {
    const database = openBackupDatabase();
    await seed(database);
    expect(root(await database.backup.export())).not.toHaveProperty('toolData');
  });

  it.each([
    ['no categories passed', undefined],
    ['every category passed', CATEGORIES],
  ])(
    'writes every record under toolData on a full export, %s',
    async (_name, categories) => {
      const { backup } = await withToolData();
      const file = root(await backup.export(categories));
      expect(file.version).toBe(BACKUP_VERSION);
      expect(file.categories).toEqual(CATEGORIES);
      expect(file.toolData).toEqual({
        version: TOOL_DATA_SECTION_VERSION,
        records: [
          {
            toolId: 'chords',
            key: 'favourites',
            value: '["Am7"]',
            updatedAt: SAVED_AT_SECONDS,
          },
          {
            toolId: 'drone',
            key: 'note',
            value: '{"pitch":"D"}',
            updatedAt: SAVED_AT_SECONDS,
          },
        ],
      });
    },
  );

  it('leaves tool data out of a partial export', async () => {
    const { backup } = await withToolData();
    expect(root(await backup.export(['tunings']))).not.toHaveProperty(
      'toolData',
    );
  });

  it('keeps the export parseable', async () => {
    const { backup } = await withToolData();
    expect(parseBackup(await backup.export()).categories).toEqual(CATEGORIES);
  });

  it('leaves tool data out of a shared setlist', async () => {
    const { backup, friday } = await withToolData();
    expect(root(await backup.exportSetlist(friday.uuid))).not.toHaveProperty(
      'toolData',
    );
  });
});

describe('restoring a file without toolData', () => {
  it('keeps every tool data row on Replace', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const text = await source.backup.export();
    const { backup, toolData } = await withToolData();
    const plan = unwrap(
      await backup.plan(text, { mode: 'replace', categories: [...CATEGORIES] }),
    );
    unwrap(await backup.apply(plan, { confirmReplace: true }));
    expect(await toolData.forTool('chords').get('favourites')).toBe('["Am7"]');
    expect(await toolData.forTool('drone').get('note')).toBe('{"pitch":"D"}');
  });
});
