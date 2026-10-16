import type { NewTuning } from '@kitbag/core-db';
import { KB_TUNER_INSTRUMENT } from '@kitbag/core-native';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTunerStore } from './store.ts';
import { createHarness, settle, type Harness } from './store.test-helper.ts';

let fakes: Harness['fakes'];
let repo: Harness['repo'];
let s: Harness['s'];

beforeEach(() => {
  ({ fakes, repo, s } = createHarness());
});

describe('custom tunings', () => {
  const OPEN_G: NewTuning = {
    name: 'Open G',
    instrument: KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_GUITAR,
    notes: [38, 43, 50, 55, 59, 62],
  };

  it('creates, lists, updates and deletes through the repository', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    expect(s().customTunings).toEqual([created]);

    await s().updateCustomTuning(created.id, { name: 'Open G (low)' });
    expect(repo.spies.update).toHaveBeenCalledWith(created.id, {
      name: 'Open G (low)',
    });
    expect(s().customTunings[0]?.name).toBe('Open G (low)');

    const fresh = createTunerStore({
      runtime: () => fakes.runtime,
      tunings: () => repo.repository,
    });
    await fresh.getState().loadCustomTunings();
    expect(fresh.getState().customTunings).toEqual(s().customTunings);

    await s().deleteCustomTuning(created.id);
    expect(s().customTunings).toEqual([]);
    expect(repo.rows).toEqual([]);
  });

  it('re-sends the selected custom tuning when it is edited', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    s().enter({ ...OPEN_G, customId: created.id });
    await settle();
    fakes.calls.length = 0;

    const edited = [37, 43, 50, 55, 59, 62];
    await s().updateCustomTuning(created.id, { notes: edited });
    await settle();
    expect(s().tuning?.notes).toEqual(edited);
    expect(fakes.calls).toEqual([
      ['tunerSetTuning', OPEN_G.instrument, edited],
    ]);
  });

  it('keeps the mode and tuned strings when the selected tuning is renamed', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    s().enter({ ...OPEN_G, customId: created.id });
    await settle();
    s().lockString(2);
    s().markTuned(2);
    await settle();
    fakes.calls.length = 0;

    await s().updateCustomTuning(created.id, { name: 'Slack G' });
    await settle();
    expect(s().tuning?.name).toBe('Slack G');
    expect(s().mode).toEqual({ kind: 'manual', string: 2 });
    expect(s().tunedStrings).toEqual([2]);
    expect(fakes.calls).toEqual([]);
  });

  it('keeps the notes but drops the link when the selected tuning is deleted', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    s().setTuning({ ...OPEN_G, customId: created.id });
    await s().deleteCustomTuning(created.id);
    expect(s().tuning).toEqual(OPEN_G);
  });

  it('leaves the list unchanged when the repository refuses', async () => {
    repo.spies.create.mockRejectedValueOnce(new Error('invalid'));
    await expect(s().createCustomTuning(OPEN_G)).rejects.toThrow('invalid');
    expect(s().customTunings).toEqual([]);
  });
});
