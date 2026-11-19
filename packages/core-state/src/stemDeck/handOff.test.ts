import type { StemDeckImportItem } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { BundleAddOutcome } from '../songLibrary/stemBundleLogic.ts';
import { createHandOff, type HandOffDeps } from './handOff.ts';
import { CODES, item, snapshot } from './store.test-helper.ts';

const URI = 'file:/data/files/.stemdeck-downloads/aaaaaaaaaaaa.zip';

function adding(
  jobId = 'aaaaaaaaaaaa',
  fileUri = URI,
  overrides: Partial<StemDeckImportItem> = {},
) {
  return snapshot([item(jobId, CODES.stateAdding, { fileUri, ...overrides })]);
}

function setup(add: () => Promise<BundleAddOutcome>) {
  const deps = {
    addFetchedBundle: vi.fn<HandOffDeps['addFetchedBundle']>(add),
    settle: vi.fn(),
    settled: vi.fn(),
  };
  return { deps, handOff: createHandOff(deps) };
}

describe('hand-off', () => {
  it('adds a finished download through the library and settles it once', async () => {
    const { deps, handOff } = setup(() => Promise.resolve({ kind: 'added' }));
    await Promise.all([
      handOff.receive(adding(), CODES),
      handOff.receive(adding(), CODES),
    ]);
    await handOff.receive(adding(), CODES);
    expect(deps.addFetchedBundle).toHaveBeenCalledTimes(1);
    expect(deps.addFetchedBundle).toHaveBeenCalledWith(
      { uri: URI, name: 'Song aaaaaaaaaaaa', isFolder: false },
      { kind: 'add' },
    );
    expect(deps.settle.mock.calls).toEqual([
      ['aaaaaaaaaaaa', CODES.settleAdded],
    ]);
  });

  it('settles exactly once when adding throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { deps, handOff } = setup(() => Promise.reject(new Error('db')));
    await handOff.receive(adding(), CODES);
    await handOff.receive(adding(), CODES);
    expect(deps.settle.mock.calls).toEqual([
      ['aaaaaaaaaaaa', CODES.settleFailed],
    ]);
    expect(deps.settled).toHaveBeenCalledWith('aaaaaaaaaaaa', null);
  });

  it.each<[BundleAddOutcome, string]>([
    [{ kind: 'alreadyInLibrary' }, CODES.settleSkipped],
    [
      {
        kind: 'refused',
        refusal: {
          reason: 'noSpace',
          version: 1,
          supportedVersion: 1,
          stemCount: 6,
          maxStems: 16,
          stemFormat: '',
          supportedStemFormat: 'flac',
        },
      },
      CODES.settleRefused,
    ],
    [{ kind: 'copyFailed' }, CODES.settleFailed],
    [{ kind: 'addFailed' }, CODES.settleFailed],
  ])('settles %j as %s', async (outcome, code) => {
    const { deps, handOff } = setup(() => Promise.resolve(outcome));
    await handOff.receive(adding(), CODES);
    expect(deps.settle.mock.calls).toEqual([['aaaaaaaaaaaa', code]]);
  });

  it('replaces only the songs native carries a replace for, naming any target', async () => {
    const { deps, handOff } = setup(() => Promise.resolve({ kind: 'added' }));
    const TARGET = 7;
    await handOff.receive(adding('aaaaaaaaaaaa'), CODES);
    await handOff.receive(
      adding('bbbbbbbbbbbb', `${URI}.b`, { replace: CODES.replaceJob }),
      CODES,
    );
    await handOff.receive(
      adding('cccccccccccc', `${URI}.c`, {
        replace: CODES.replaceSet,
        replaceTarget: TARGET,
      }),
      CODES,
    );
    expect(deps.addFetchedBundle.mock.calls.map((call) => call[1])).toEqual([
      { kind: 'add' },
      { kind: 'replaceJob' },
      { kind: 'replaceSet', targetId: TARGET },
    ]);
  });

  it.each<Partial<StemDeckImportItem>>([
    { replace: 'unknown' },
    { replace: CODES.replaceSet, replaceTarget: null },
  ])('settles %j as failed without adding it', async (overrides) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { deps, handOff } = setup(() => Promise.resolve({ kind: 'added' }));
    await handOff.receive(adding('aaaaaaaaaaaa', URI, overrides), CODES);
    expect(deps.addFetchedBundle).not.toHaveBeenCalled();
    expect(deps.settle.mock.calls).toEqual([
      ['aaaaaaaaaaaa', CODES.settleFailed],
    ]);
  });

  it('takes the same file again once a retry brings it back', async () => {
    const { deps, handOff } = setup(() => Promise.resolve({ kind: 'added' }));
    await handOff.receive(adding(), CODES);
    await handOff.receive(
      snapshot([item('aaaaaaaaaaaa', CODES.stateFailed)]),
      CODES,
    );
    await handOff.receive(adding(), CODES);
    expect(deps.settle).toHaveBeenCalledTimes(2);
  });

  it('ignores items that are not being added or have no file', async () => {
    const { deps, handOff } = setup(() => Promise.resolve({ kind: 'added' }));
    await handOff.receive(
      snapshot([
        item('aaaaaaaaaaaa', CODES.stateDownloading, { fileUri: URI }),
        item('bbbbbbbbbbbb', CODES.stateAdding),
      ]),
      CODES,
    );
    expect(deps.addFetchedBundle).not.toHaveBeenCalled();
    expect(deps.settle).not.toHaveBeenCalled();
  });
});
