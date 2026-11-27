import { describe, expect, it } from 'vitest';

import { BACKUP_VERSION, CATEGORIES } from './backup-format';
import { parseBackup } from './backup-parse';
import { openBackupDatabase, seed } from './backup.test-helper';
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
  return { ...database, ...seeded };
}

const root = (text: string) => JSON.parse(text) as Record<string, unknown>;

describe('exporting tool data', () => {
  it('writes no toolData key when no tool has data', async () => {
    const database = openBackupDatabase();
    await seed(database);
    expect(root(await database.backup.export())).not.toHaveProperty('toolData');
  });

  it('writes every record under toolData, outside the categories', async () => {
    const { backup } = await withToolData();
    const file = root(await backup.export(['tunings']));
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.categories).toEqual(['tunings']);
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
