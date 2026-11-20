import { DatabaseOpenError } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storedPreference } from './storedPreference.ts';

const core = vi.hoisted(() => ({ openDatabase: vi.fn() }));

vi.mock('@kitbag/core-db', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  openDatabase: core.openDatabase,
}));

vi.mock('@kitbag/core-native', () => ({
  deleteClickSound: vi.fn(),
  readClickSound: vi.fn(),
  writeClickSound: vi.fn(),
}));

const REFUSED = new DatabaseOpenError('newer-version', { fromVersion: 99 });
const ACCESSES = 10;
const PREFERENCE_KEYS = ['theme', 'haptics', 'last_tool', 'home', 'count_in'];
const OPENED = { preferences: { get: () => 'stored' } };

async function freshDatabase() {
  vi.resetModules();
  return import('./database.ts');
}

function quietly<T>(read: () => T): T {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    return read();
  } finally {
    warn.mockRestore();
  }
}

beforeEach(() => {
  core.openDatabase.mockReset();
});

describe('a database that fails to open', () => {
  beforeEach(() => {
    core.openDatabase.mockImplementation(() => {
      throw REFUSED;
    });
  });

  it('is opened once per launch, however many reads follow', async () => {
    const { getDatabase } = await freshDatabase();
    for (let i = 0; i < ACCESSES; i += 1)
      expect(() => getDatabase()).toThrow(REFUSED);
    const reads = quietly(() =>
      PREFERENCE_KEYS.map((key) =>
        storedPreference(() => getDatabase().preferences, key, key).read(),
      ),
    );

    expect(reads).toEqual(PREFERENCE_KEYS.map(() => undefined));
    expect(core.openDatabase).toHaveBeenCalledOnce();
  });

  it('reports the typed error, kind included', async () => {
    const { databaseStatus } = await freshDatabase();

    expect(databaseStatus()).toEqual({ ok: false, error: REFUSED });
  });

  it('opens again only when asked to retry', async () => {
    const { getDatabase, retryDatabase } = await freshDatabase();
    expect(() => getDatabase()).toThrow(REFUSED);

    expect(retryDatabase().ok).toBe(false);
    expect(() => getDatabase()).toThrow(REFUSED);
    expect(core.openDatabase).toHaveBeenCalledTimes(2);
  });

  it('serves the database a successful retry opened', async () => {
    const { getDatabase, retryDatabase } = await freshDatabase();
    expect(() => getDatabase()).toThrow(REFUSED);
    core.openDatabase.mockReturnValue(OPENED);

    expect(retryDatabase()).toEqual({ ok: true, database: OPENED });
    expect(getDatabase()).toBe(OPENED);
    expect(core.openDatabase).toHaveBeenCalledTimes(2);
  });

  it('wraps an untyped throw as a failed open', async () => {
    const cause = new Error('native module missing');
    core.openDatabase.mockImplementation(() => {
      throw cause;
    });
    const { databaseStatus } = await freshDatabase();

    const status = databaseStatus();

    expect(status.ok).toBe(false);
    expect(!status.ok && status.error.kind).toBe('open');
    expect(!status.ok && status.error.cause).toBe(cause);
  });
});

describe('a database that opens', () => {
  it('is opened once and never reopened by a retry', async () => {
    core.openDatabase.mockReturnValue(OPENED);
    const { getDatabase, retryDatabase } = await freshDatabase();

    expect(getDatabase()).toBe(OPENED);
    expect(retryDatabase()).toEqual({ ok: true, database: OPENED });
    expect(core.openDatabase).toHaveBeenCalledOnce();
  });
});
