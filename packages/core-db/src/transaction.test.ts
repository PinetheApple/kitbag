import { afterEach, describe, expect, it } from 'vitest';

import { setlists } from './schema';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  const insert = (name: string) =>
    handle.db.insert(setlists).values({ name, uuid: name });
  const names = async () =>
    (await handle.db.select().from(setlists)).map((row) => row.name);
  return { ...handle, insert, names };
}

describe('transactor', () => {
  it('commits and returns the work result', async () => {
    const { transactor, insert, names } = setup();
    const result = await transactor.transaction(async () => {
      await insert('A');
      await insert('B');
      return 'done';
    });
    expect(result).toBe('done');
    expect(await names()).toEqual(['A', 'B']);
  });

  it('leaves no partial write when the work throws midway', async () => {
    const { transactor, insert, names } = setup();
    await expect(
      transactor.transaction(async () => {
        await insert('A');
        throw new Error('midway');
      }),
    ).rejects.toThrow('midway');
    expect(await names()).toEqual([]);
  });

  it('keeps a concurrent call out of an open transaction', async () => {
    const { transactor, insert, names } = setup();
    const failing = transactor.transaction(async () => {
      await insert('A');
      await new Promise((resolve) => setTimeout(resolve, 1));
      throw new Error('late');
    });
    const other = transactor.serial(async () => {
      await insert('B');
    });
    await expect(failing).rejects.toThrow('late');
    await other;
    expect(await names()).toEqual(['B']);
  });
});
