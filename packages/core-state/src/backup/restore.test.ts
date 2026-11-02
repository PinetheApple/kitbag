import {
  openBackupDatabase,
  presetValues,
  records,
  seed,
  unwrap,
  type BackupDatabase,
} from '@kitbag/core-db/src/backup.test-helper';
import { describe, expect, it, vi } from 'vitest';

import {
  canApply,
  commitStep,
  createRestoreStore,
  planConflicts,
} from './restore.ts';
import type { BackupDeps } from './runtime.ts';

type Picked = Awaited<ReturnType<BackupDeps['pick']>>;

function harness(target: BackupDatabase, picked: () => Promise<Picked>) {
  const afterRestore = vi.fn(() => Promise.resolve());
  const deps: BackupDeps = {
    service: () => target.backup,
    pick: picked,
    share: () => Promise.resolve(),
    afterRestore,
  };
  const store = createRestoreStore(() => deps);
  return { store, afterRestore, state: () => store.getState().restore };
}

const file = (contents: string) => () =>
  Promise.resolve({
    name: 'kitbag_export.json',
    bytes: contents.length,
    contents,
  });

async function seededExport() {
  const source = openBackupDatabase();
  const seeded = await seed(source);
  return { source, seeded, text: await source.backup.export() };
}

async function diverged() {
  const { source, seeded, text } = await seededExport();
  const target = openBackupDatabase();
  unwrap(await target.backup.apply(unwrap(await target.backup.plan(text))));
  await source.presets.update(seeded.opener.id, { bpm: 90 });
  await source.sets.rename(seeded.acoustic.id, 'Unplugged');
  return { target, seeded, text: await source.backup.export() };
}

function review(state: ReturnType<ReturnType<typeof harness>['state']>) {
  if (state.phase !== 'review') throw new Error(`phase ${state.phase}`);
  return state;
}

describe('picking a file', () => {
  it('stays empty when the picker is cancelled', async () => {
    const h = harness(openBackupDatabase(), () => Promise.resolve(null));
    await h.store.getState().pick();
    expect(h.state()).toEqual({ phase: 'empty' });
  });

  it('reports an unreadable file without planning', async () => {
    const h = harness(openBackupDatabase(), () =>
      Promise.reject(new Error('too large')),
    );
    await h.store.getState().pick();
    expect(h.state()).toEqual({
      phase: 'failed',
      failure: { kind: 'unreadable' },
    });
  });

  it.each([
    [
      'a newer version',
      '{"format":"kitbag-backup","version":5}',
      'unsupportedVersion',
    ],
    ['malformed JSON', '{not json', 'malformedFile'],
    ['a foreign file', '{"hello":1}', 'malformedFile'],
  ])(
    'refuses %s with its typed failure and writes nothing',
    async (_n, text, kind) => {
      const target = openBackupDatabase();
      await seed(target);
      const before = await records(target);
      const h = harness(target, file(text));

      await h.store.getState().pick();

      expect(h.state()).toMatchObject({ phase: 'failed', failure: { kind } });
      expect(await records(target)).toEqual(before);
      expect(h.afterRestore).not.toHaveBeenCalled();
    },
  );

  it('opens a merge review with live counts and the default categories', async () => {
    const { text } = await seededExport();
    const h = harness(openBackupDatabase(), file(text));

    await h.store.getState().pick();

    const state = review(h.state());
    expect(state.source).toEqual({
      name: 'kitbag_export.json',
      bytes: text.length,
    });
    expect(state.plan.mode).toBe('merge');
    expect(state.plan.categories).toEqual([
      'songPresets',
      'setlists',
      'tunings',
      'countInSettings',
    ]);
    expect(state.plan.counts.setlists).toMatchObject({ incoming: 2, new: 2 });
  });
});

describe('reviewing', () => {
  it('re-counts when switching to replace and names what it deletes', async () => {
    const { target, text } = await diverged();
    await target.presets.create(presetValues('Mine only', null));
    const h = harness(target, file(text));
    await h.store.getState().pick();

    await h.store.getState().setMode('replace');

    const state = review(h.state());
    expect(state.plan.mode).toBe('replace');
    expect(state.plan.counts.songPresets).toMatchObject({ deletes: 3, new: 2 });
    expect(state.plan.counts.setlists).toMatchObject({ deletes: 2 });
  });

  it('re-plans the selection, carrying presets with setlists', async () => {
    const { text } = await seededExport();
    const h = harness(openBackupDatabase(), file(text));
    await h.store.getState().pick();

    await h.store.getState().toggleCategory('songPresets');
    expect(review(h.state()).plan.categories).toEqual([
      'tunings',
      'countInSettings',
    ]);
    await h.store.getState().toggleCategory('setlists');
    expect(review(h.state()).plan.categories).toEqual([
      'songPresets',
      'setlists',
      'tunings',
      'countInSettings',
    ]);
  });

  it('holds apply until every conflict has a side, with no default winner', async () => {
    const { target, text } = await diverged();
    const h = harness(target, file(text));
    await h.store.getState().pick();
    const conflicts = planConflicts(review(h.state()).plan);
    expect(conflicts.map((c) => c.label).sort()).toEqual([
      'Opener',
      'Unplugged',
    ]);
    expect(canApply(h.state())).toBe(false);

    const before = await records(target);
    await h.store.getState().apply();
    expect(await records(target)).toEqual(before);

    const [first, second] = conflicts;
    if (!first || !second) throw new Error('two conflicts expected');
    await h.store.getState().resolve(first, 'mine');
    expect(canApply(h.state())).toBe(false);
    await h.store.getState().resolve(second, 'theirs');
    expect(canApply(h.state())).toBe(true);
  });
});

describe('applying', () => {
  it('merges, reports the counts and refreshes the app', async () => {
    const { text } = await seededExport();
    const target = openBackupDatabase();
    const h = harness(target, file(text));
    await h.store.getState().pick();

    await h.store.getState().apply();

    expect(h.state()).toMatchObject({ phase: 'done', mode: 'merge' });
    expect(h.afterRestore).toHaveBeenCalledOnce();
    const again = unwrap(await target.backup.plan(text));
    expect(again.counts.setlists).toMatchObject({ new: 0, unchanged: 2 });
  });

  it('refuses replace without the typed word, writing nothing', async () => {
    const { target, text } = await diverged();
    const h = harness(target, file(text));
    await h.store.getState().pick();
    await h.store.getState().setMode('replace');
    const before = await records(target);

    await h.store.getState().apply('yes');

    expect(h.state().phase).toBe('review');
    expect(await records(target)).toEqual(before);
  });

  it('replaces once the word is typed', async () => {
    const { target, text } = await diverged();
    await target.presets.create(presetValues('Mine only', null));
    const h = harness(target, file(text));
    await h.store.getState().pick();
    await h.store.getState().setMode('replace');

    await h.store.getState().apply('Replace');

    expect(h.state()).toMatchObject({ phase: 'done', mode: 'replace' });
    const names = (await target.presets.list()).map((p) => p.name).sort();
    expect(names).toEqual(['Closer', 'Opener']);
  });

  it('re-counts instead of writing when the library changed under the plan', async () => {
    const { text } = await seededExport();
    const target = openBackupDatabase();
    const h = harness(target, file(text));
    await h.store.getState().pick();
    unwrap(await target.backup.apply(unwrap(await target.backup.plan(text))));

    await h.store.getState().apply();

    const state = review(h.state());
    expect(state.stale).toBe(true);
    expect(h.afterRestore).not.toHaveBeenCalled();
  });
});

describe('the commit button', () => {
  it('opens the conflict review while any conflict is open, never applying', async () => {
    const { target, text } = await diverged();
    const h = harness(target, file(text));
    await h.store.getState().pick();
    expect(commitStep(h.state())).toBe('review');
    for (const c of planConflicts(review(h.state()).plan))
      await h.store.getState().resolve(c, 'mine');
    expect(commitStep(h.state())).toBe('apply');
  });

  it('asks for the typed word before a replace', async () => {
    const { target, text } = await diverged();
    const h = harness(target, file(text));
    await h.store.getState().pick();
    await h.store.getState().setMode('replace');
    expect(commitStep(h.state())).toBe('confirmReplace');
  });

  it('waits while a plan is being counted', async () => {
    const { text } = await seededExport();
    const h = harness(openBackupDatabase(), file(text));
    await h.store.getState().pick();
    const pending = h.store.getState().toggleCategory('tunings');
    expect(commitStep(h.state())).toBe('wait');
    await pending;
  });
});

describe('actions during a re-count', () => {
  it('ignores a resolve sent before the toggle is counted, keeping the toggle', async () => {
    const { target, text } = await diverged();
    const h = harness(target, file(text));
    await h.store.getState().pick();
    const [conflict] = planConflicts(review(h.state()).plan);
    if (!conflict) throw new Error('conflict expected');

    const toggled = h.store.getState().toggleCategory('tunings');
    const resolved = h.store.getState().resolve(conflict, 'mine');
    await Promise.all([toggled, resolved]);

    const state = review(h.state());
    expect(state.plan.categories).not.toContain('tunings');
    expect(state.resolutions).toEqual({});
  });
});
