import { toSeconds } from './backup-snapshot';
import type { Database } from './repository';
import { selectAllToolData } from './tool-data-repository';

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

export async function loadToolDataSection(
  db: Database,
): Promise<ToolDataSection | undefined> {
  const rows = await selectAllToolData(db);
  if (rows.length === 0) return undefined;
  return {
    version: TOOL_DATA_SECTION_VERSION,
    records: rows.map((row) => ({
      ...row,
      updatedAt: toSeconds(row.updatedAt),
    })),
  };
}
