import type { ImportMode } from './backup-format';
import { fromSeconds, loadToolDataRecords } from './backup-snapshot';
import type { Database } from './repository';
import { toolData } from './schema';

export const TOOL_DATA_SECTION_VERSION = 1;

export interface ToolDataRecord {
  toolId: string;
  key: string;
  value: string;
  updatedAt: number;
}

export interface ToolDataSection {
  version: typeof TOOL_DATA_SECTION_VERSION;
  records: ToolDataRecord[];
}

export const toolDataKey = ({ toolId, key }: ToolDataRecord) =>
  `${toolId}:${key}`;

export async function loadToolDataSection(
  db: Database,
  keepEmpty = false,
): Promise<ToolDataSection | undefined> {
  const records = await loadToolDataRecords(db);
  if (records.length === 0 && !keepEmpty) return undefined;
  return { version: TOOL_DATA_SECTION_VERSION, records };
}

export async function restoreToolData(
  db: Database,
  mode: ImportMode,
  records: readonly ToolDataRecord[],
): Promise<void> {
  if (mode === 'replace') await db.delete(toolData);
  for (const record of records) {
    const set = {
      value: record.value,
      updatedAt: fromSeconds(record.updatedAt),
    };
    await db
      .insert(toolData)
      .values({ toolId: record.toolId, key: record.key, ...set })
      .onConflictDoUpdate({ target: [toolData.toolId, toolData.key], set });
  }
}
