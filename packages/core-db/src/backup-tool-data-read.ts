import { asArray, invalidField, reader } from './backup-reader';
import {
  TOOL_DATA_SECTION_VERSION,
  toolDataKey,
  type ToolDataRecord,
  type ToolDataSection,
} from './backup-tool-data';
import { isRecord } from './guards';
import { checkToolDataWrite, ToolDataRejected } from './tool-data-repository';

const SECTION_PATH = '$.toolData';

function readRecord(value: unknown, path: string): ToolDataRecord {
  const r = reader(value, path);
  const record = {
    toolId: r.string('toolId'),
    key: r.string('key'),
    value: r.string('value'),
    updatedAt: r.count('updatedAt'),
  };
  try {
    checkToolDataWrite(record.toolId, record.key, record.value);
  } catch (error) {
    if (error instanceof ToolDataRejected) invalidField(path, error.reason);
    throw error;
  }
  return record;
}

// A section from a newer writer is skipped, as a reader from before tool data
// skips any, so the categories in the file still restore.
export function readToolDataSection(
  value: unknown,
): ToolDataSection | undefined {
  if (!isRecord(value) || value.version !== TOOL_DATA_SECTION_VERSION)
    return undefined;
  const path = `${SECTION_PATH}.records`;
  const seen = new Set<string>();
  const records = asArray(value.records, path).map((item, index) => {
    const at = `${path}[${String(index)}]`;
    const record = readRecord(item, at);
    const key = toolDataKey(record);
    if (seen.has(key)) invalidField(at, 'repeated tool id and key');
    seen.add(key);
    return record;
  });
  return { version: TOOL_DATA_SECTION_VERSION, records };
}
