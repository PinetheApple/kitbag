import {
  openBackupDatabase,
  presetValues,
  seed,
  unwrap,
  type BackupDatabase,
} from '@kitbag/core-db/src/backup.test-helper';
import { createRouteLatencyRepository } from '@kitbag/core-db/src/route-latency-repository';
import { CATEGORIES, type Category } from '@kitbag/core-db';
import type { OutputRoute } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRouteLatencyStore } from '../rig/routeLatency.ts';
import {
  beforeReplaceTakenAt,
  openableBeforeReplace,
} from './beforeReplace.ts';
import { createRestoreStore } from './restore.ts';
import type { BackupDeps } from './runtime.ts';

const COPY_NAME = 'Before replace';
const PRESETS_AND_SETLISTS: Category[] = ['songPresets', 'setlists'];
const EARBUDS: OutputRoute = {
  id: 'bt-a2dp:AA:BB:Buds',
  name: 'Buds',
  kind: 'bluetooth',
  certain: true,
};
const STEP_MS = 5;
const TAKEN_AT = '2026-11-27T14:32:00.000Z';

function deps(
  service: BackupDeps['service'],
  beforeRestore: BackupDeps['beforeRestore'] = () => Promise.resolve(),
): BackupDeps {
  return {
    service,
    pick: () => Promise.resolve(null),
    share: () => Promise.resolve(),
    save: () => Promise.resolve(true),
    beforeRestore,
    afterRestore: vi.fn(() => Promise.resolve()),
  };
}

async function replacedTarget(categories: readonly Category[] = CATEGORIES) {
  const source = openBackupDatabase();
  await seed(source);
  const target = openBackupDatabase();
  await target.presets.create(presetValues('Mine only', null));
  const plan = unwrap(
    await target.backup.plan(await source.backup.export(), {
      mode: 'replace',
      categories,
    }),
  );
  unwrap(await target.backup.apply(plan, { confirmReplace: true }));
  return { source, target };
}

async function openCopy(target: BackupDatabase) {
  const backup = deps(() => target.backup);
  const store = createRestoreStore(() => backup);
  await store.getState().open(() => openableBeforeReplace(COPY_NAME, backup));
  return store;
}

function routeLatencyOn(target: BackupDatabase) {
  let applied = 0;
  const repository = createRouteLatencyRepository(target.handle);
  return createRouteLatencyStore({
    list: () => repository.list(),
    save: (entry) => repository.save(entry),
    remove: (route) => repository.remove(route),
    watchOutputRoute: (listener) => {
      listener(EARBUDS);
      return () => undefined;
    },
    applyLatency: (offsetMs) => {
      applied = offsetMs;
    },
    appliedLatency: () => applied,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the copy kept before a replace', () => {
  it('reads as nothing before any replace', async () => {
    const target = openBackupDatabase();
    expect(
      await openableBeforeReplace(
        COPY_NAME,
        deps(() => target.backup),
      ),
    ).toBeNull();
  });

  it('has no date before any replace', async () => {
    const target = openBackupDatabase();
    expect(await beforeReplaceTakenAt(deps(() => target.backup))).toBeNull();
  });

  it('is dated when the replace took it', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(TAKEN_AT) });
    const { target } = await replacedTarget();
    vi.useRealTimers();
    expect(await beforeReplaceTakenAt(deps(() => target.backup))).toBe(
      TAKEN_AT,
    );
  });

  it('opens in the restore review as a replace of what was replaced', async () => {
    const { target } = await replacedTarget(PRESETS_AND_SETLISTS);
    const store = await openCopy(target);
    expect(store.getState().restore).toMatchObject({
      phase: 'review',
      source: { name: COPY_NAME },
      plan: { mode: 'replace', categories: PRESETS_AND_SETLISTS },
    });
  });

  it('puts the replaced songs back', async () => {
    const { target } = await replacedTarget();
    const store = await openCopy(target);
    await store.getState().apply('replace');

    expect(store.getState().restore.phase).toBe('done');
    expect((await target.presets.list()).map(({ name }) => name)).toEqual([
      'Mine only',
    ]);
  });
});

describe('a restore', () => {
  it('stores a pending route latency change before it applies', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const source = openBackupDatabase();
    const target = openBackupDatabase();
    await createRouteLatencyRepository(target.handle).save({
      route: EARBUDS.id,
      offsetMs: 0,
      name: EARBUDS.name,
      kind: EARBUDS.kind,
    });
    const routes = routeLatencyOn(target);
    await routes.getState().start();
    routes.getState().step(STEP_MS);
    const backup = deps(
      () => target.backup,
      () => routes.getState().flush(),
    );
    const store = createRestoreStore(() => backup);
    const contents = await source.backup.export();
    await store.getState().open(() =>
      Promise.resolve({
        name: COPY_NAME,
        bytes: contents.length,
        contents,
        replace: CATEGORIES,
      }),
    );
    await store.getState().apply('replace');

    expect(store.getState().restore).toMatchObject({ phase: 'done' });
    const kept = await target.backup.keptBeforeReplace();
    expect(JSON.parse(kept?.contents ?? '{}')).toMatchObject({
      rigSettings: [
        expect.objectContaining({ route: EARBUDS.id, offsetMs: STEP_MS }),
      ],
    });
  });
});
