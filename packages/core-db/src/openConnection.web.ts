import type { DB } from '@op-engineering/op-sqlite';

// op-sqlite reads its native constants at import, so the web bundle must not load it.
export function openConnection(name: string): DB {
  throw new Error(`No SQLite on web; ${name} needs a memory store`);
}
