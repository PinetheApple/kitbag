import { afterEach, describe, expect, it } from 'vitest';

import { createRouteLatencyRepository } from './route-latency-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return createRouteLatencyRepository(handle);
}

const HEADPHONES = {
  route: 'bt-a2dp:EE:FF:WH-1000XM4',
  offsetMs: 182,
  name: 'WH-1000XM4',
  kind: 'bluetooth',
} as const;

describe('route latency', () => {
  it('has no offset for a route never calibrated', async () => {
    const repo = setup();
    expect(await repo.get('speaker')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });

  it('stores an offset with the name and kind the route had', async () => {
    const repo = setup();
    await repo.save(HEADPHONES);
    expect(await repo.get(HEADPHONES.route)).toEqual(HEADPHONES);
  });

  it('replaces a route offset instead of adding a second row', async () => {
    const repo = setup();
    await repo.save(HEADPHONES);
    await repo.save({ ...HEADPHONES, offsetMs: 160, name: 'XM4' });
    expect(await repo.list()).toEqual([
      { ...HEADPHONES, offsetMs: 160, name: 'XM4' },
    ]);
  });

  it('lists routes that are not connected', async () => {
    const repo = setup();
    const speaker = {
      route: 'speaker',
      offsetMs: 0,
      name: '',
      kind: 'speaker',
    };
    await repo.save(speaker);
    await repo.save(HEADPHONES);
    expect(await repo.list()).toEqual(
      expect.arrayContaining([speaker, HEADPHONES]),
    );
  });
});
