import type { NewTuning, Tuning, TuningRepository } from '@kitbag/core-db';

// Web-only stand-in for core-db's tunings table: the web build has no
// op-sqlite. Persists to the given storage so custom tunings survive a reload
// in the browser. Never on the device path. It does not repeat core-db's row
// validation (tuning-rules.ts is not exported); the editor bounds its input.

export interface TextStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface Table {
  rows: Tuning[];
  nextId: number;
}

function load(storage: TextStorage | undefined, key: string): Table {
  const saved = storage?.getItem(key);
  if (saved === null || saved === undefined) return { rows: [], nextId: 1 };
  return JSON.parse(saved) as Table;
}

function copy(row: Tuning): Tuning {
  return { ...row, notes: [...row.notes] };
}

export function createMemoryTunings(
  storage?: TextStorage,
  key = 'kitbag.tunings',
): TuningRepository {
  const table = load(storage, key);
  const save = () => {
    storage?.setItem(key, JSON.stringify(table));
  };

  return {
    list: () => Promise.resolve(table.rows.map(copy)),
    create: (values: NewTuning) => {
      const row: Tuning = {
        ...values,
        notes: [...values.notes],
        id: table.nextId++,
        uuid: globalThis.crypto.randomUUID(),
      };
      table.rows.push(row);
      save();
      return Promise.resolve(copy(row));
    },
    update: (id, values) => {
      const row = table.rows.find((r) => r.id === id);
      if (row === undefined) {
        return Promise.reject(new Error(`Tuning ${String(id)} not found`));
      }
      Object.assign(row, values);
      if (values.notes !== undefined) row.notes = [...values.notes];
      save();
      return Promise.resolve();
    },
    delete: (id) => {
      table.rows = table.rows.filter((r) => r.id !== id);
      save();
      return Promise.resolve();
    },
  };
}
