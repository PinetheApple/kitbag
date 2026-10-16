import type { Transactor } from './transaction';

export type SyncQuery = (
  sql: string,
  params: string[],
) => readonly Record<string, unknown>[];

export interface Preferences {
  readonly get: (key: string) => string | undefined;
  readonly set: (key: string, value: string) => Promise<void>;
}

// Reads are synchronous so a screen can have its value on first render. Writes
// queue behind the transactor: a statement issued while another caller's BEGIN
// is open joins that transaction and would roll back with it.
export function createPreferences(
  query: SyncQuery,
  transactor: Transactor,
): Preferences {
  return {
    get: (key) => {
      const value = query('SELECT value FROM preferences WHERE key = ?', [
        key,
      ])[0]?.value;
      return typeof value === 'string' ? value : undefined;
    },
    set: (key, value) =>
      transactor.serial(() => {
        query(
          'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
          [key, value],
        );
        return Promise.resolve();
      }),
  };
}
