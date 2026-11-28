import { TOOL_ID_PATTERN } from '@kitbag/core-plugin-api';
import { and, asc, eq } from 'drizzle-orm';

import type { Database, DatabaseHandle } from './repository';
import { toolData } from './schema';
import { BYTES_PER_KIB } from './units';

const MAX_TOOL_DATA_VALUE_KIB = 64;
export const MAX_TOOL_DATA_VALUE_BYTES =
  MAX_TOOL_DATA_VALUE_KIB * BYTES_PER_KIB;
export const MAX_TOOL_DATA_KEY_BYTES = 256;

export type ToolDataRow = typeof toolData.$inferSelect;
export type ToolDataEntry = Omit<ToolDataRow, 'toolId'>;
export type ToolDataRejection =
  'emptyId' | 'invalidToolId' | 'keyTooLong' | 'invalidJson' | 'tooLarge';

export class ToolDataRejected extends Error {
  constructor(readonly reason: ToolDataRejection) {
    super(reason);
  }
}

export interface ToolData {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(): Promise<ToolDataEntry[]>;
  clear(): Promise<void>;
}

export interface ToolDataRepository {
  forTool(toolId: string): ToolData;
}

const utf8 = new TextEncoder();

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function checkToolDataWrite(
  toolId: string,
  key: string,
  value: string,
): void {
  if (toolId === '' || key === '') throw new ToolDataRejected('emptyId');
  if (!TOOL_ID_PATTERN.test(toolId))
    throw new ToolDataRejected('invalidToolId');
  if (utf8.encode(key).byteLength > MAX_TOOL_DATA_KEY_BYTES)
    throw new ToolDataRejected('keyTooLong');
  if (utf8.encode(value).byteLength > MAX_TOOL_DATA_VALUE_BYTES)
    throw new ToolDataRejected('tooLarge');
  if (!isJson(value)) throw new ToolDataRejected('invalidJson');
}

export function selectAllToolData(db: Database): Promise<ToolDataRow[]> {
  return db
    .select()
    .from(toolData)
    .orderBy(asc(toolData.toolId), asc(toolData.key));
}

export function createToolDataRepository(
  { db, transactor }: DatabaseHandle,
  now: () => Date = () => new Date(),
): ToolDataRepository {
  const forTool = (toolId: string): ToolData => {
    const ofTool = eq(toolData.toolId, toolId);
    const row = (key: string) => and(ofTool, eq(toolData.key, key));
    return {
      get: (key) =>
        transactor.serial(async () => {
          const [found] = await db
            .select({ value: toolData.value })
            .from(toolData)
            .where(row(key));
          return found?.value ?? null;
        }),
      set: async (key, value) => {
        checkToolDataWrite(toolId, key, value);
        const updatedAt = now();
        await transactor.serial(async () => {
          await db
            .insert(toolData)
            .values({ toolId, key, value, updatedAt })
            .onConflictDoUpdate({
              target: [toolData.toolId, toolData.key],
              set: { value, updatedAt },
            });
        });
      },
      remove: (key) =>
        transactor.serial(async () => {
          await db.delete(toolData).where(row(key));
        }),
      list: () =>
        transactor.serial(() =>
          db
            .select({
              key: toolData.key,
              value: toolData.value,
              updatedAt: toolData.updatedAt,
            })
            .from(toolData)
            .where(ofTool)
            .orderBy(asc(toolData.key)),
        ),
      clear: () =>
        transactor.serial(async () => {
          await db.delete(toolData).where(ofTool);
        }),
    };
  };
  return { forTool };
}
