import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { migrate } from './migrate';
import { createPreferences, type Preferences } from './preferences';
import { nodeSqliteDriver, openTestDatabase } from './sqlite.test-helper';
import { createTransactor } from './transaction';

function openFile(path: string) {
  const connection = new DatabaseSync(path);
  migrate(nodeSqliteDriver(connection));
  const preferences = createPreferences(
    (sql, params) => connection.prepare(sql).all(...params),
    createTransactor((statement) => {
      connection.exec(statement);
    }),
  );
  return { connection, preferences };
}

let handle: ReturnType<typeof openTestDatabase>;
let preferences: Preferences;

beforeEach(() => {
  handle = openTestDatabase();
  preferences = createPreferences(
    (sql, params) => handle.connection.prepare(sql).all(...params),
    handle.transactor,
  );
});

afterEach(() => {
  handle.connection.close();
});

describe('preferences', () => {
  it('reads nothing for a key never written', () => {
    expect(preferences.get('lastTool')).toBeUndefined();
  });

  it('reads back what was written, and the latest write wins', async () => {
    await preferences.set('lastTool', 'metronome');
    expect(preferences.get('lastTool')).toBe('metronome');
    await preferences.set('lastTool', 'tuner');
    expect(preferences.get('lastTool')).toBe('tuner');
  });

  it("keeps a write out of another caller's open transaction", async () => {
    let fail: (error: Error) => void = () => undefined;
    await new Promise<void>((begun) => {
      void handle.transactor
        .transaction(
          () =>
            new Promise<void>((_resolve, reject) => {
              fail = reject;
              begun();
            }),
        )
        .catch(() => undefined);
    });
    const write = preferences.set('lastTool', 'tuner');
    fail(new Error('rolled back'));
    await write;
    expect(preferences.get('lastTool')).toBe('tuner');
  });

  it('survives closing and reopening the database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kitbag-prefs-'));
    try {
      const path = join(dir, 'kitbag.db');
      const first = openFile(path);
      await first.preferences.set('lastTool', 'tuner');
      first.connection.close();
      const reopened = openFile(path);
      expect(reopened.preferences.get('lastTool')).toBe('tuner');
      reopened.connection.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
