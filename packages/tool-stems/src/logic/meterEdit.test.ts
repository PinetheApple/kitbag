import {
  GRID_METER,
  NO_METER_OVERRIDE,
  type MeterOverride,
} from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

import {
  barOneHere,
  createMeterEditor,
  editedOverride,
  meterGridState,
  NOT_SAVED,
  type MeterEditorDeps,
  type MeterNotice,
} from './meterEdit.ts';

const SET = 7;
const BEATS = [0, 0.5, 1, 1.5, 2];
const TRIPLE = GRID_METER.triple;
const QUADRUPLE = GRID_METER.quadruple;
const DETECTED = QUADRUPLE;
const YOURS = { meterBeatsPerBar: TRIPLE, barOneSeconds: 1 };
const TRIPLE_ONLY = { ...NO_METER_OVERRIDE, meterBeatsPerBar: TRIPLE };

function editor(override: MeterOverride = NO_METER_OVERRIDE) {
  const calls: string[] = [];
  let stored = override;
  const deps = {
    save: vi.fn<MeterEditorDeps['save']>(() => {
      calls.push('save');
      return Promise.resolve();
    }),
    applied: vi.fn<MeterEditorDeps['applied']>((_set, next) => {
      calls.push('applied');
      stored = next;
    }),
    target: () => ({ setId: SET, override: stored, detected: DETECTED }),
  };
  return { deps, calls, edits: createMeterEditor(deps) };
}

function held() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    gate,
    release: () => {
      release();
    },
  };
}

describe('barOneHere', () => {
  it('takes the beat nearest the playhead', () => {
    expect(barOneHere(BEATS, 1.2)).toBe(1);
    expect(barOneHere(BEATS, 1.3)).toBe(1.5);
  });

  it('takes the first beat before the grid starts', () => {
    expect(barOneHere([0.4, 0.9], 0)).toBe(0.4);
  });

  it('has nothing to take without beats', () => {
    expect(barOneHere([], 1)).toBeNull();
  });
});

describe('editedOverride', () => {
  it('sets only the meter, keeping a moved bar one', () => {
    expect(
      editedOverride(YOURS, { kind: 'meter', meter: QUADRUPLE }, DETECTED),
    ).toEqual({ ...YOURS, meterBeatsPerBar: QUADRUPLE });
  });

  it('sets only bar one, keeping the meter as it was', () => {
    expect(
      editedOverride(
        NO_METER_OVERRIDE,
        { kind: 'barOne', seconds: 1.5 },
        DETECTED,
      ),
    ).toEqual({ meterBeatsPerBar: null, barOneSeconds: 1.5 });
  });

  it('clears both on reset', () => {
    expect(editedOverride(YOURS, { kind: 'reset' }, DETECTED)).toEqual(
      NO_METER_OVERRIDE,
    );
  });

  it('changes nothing when the detected meter is picked with no override', () => {
    expect(
      editedOverride(
        NO_METER_OVERRIDE,
        { kind: 'meter', meter: DETECTED },
        DETECTED,
      ),
    ).toBeNull();
  });

  it('changes nothing when the picked meter is already yours', () => {
    expect(
      editedOverride(YOURS, { kind: 'meter', meter: TRIPLE }, DETECTED),
    ).toBeNull();
  });

  it('changes nothing on reset with no override', () => {
    expect(
      editedOverride(NO_METER_OVERRIDE, { kind: 'reset' }, DETECTED),
    ).toBeNull();
  });
});

describe('meterGridState', () => {
  it('is ready with a beat grid and failed without one', () => {
    expect(meterGridState(BEATS)).toBe('ready');
    expect(meterGridState([])).toBe('failed');
  });
});

describe('the meter editor', () => {
  const failOnce = (deps: ReturnType<typeof editor>['deps']) => {
    deps.save.mockRejectedValueOnce(new Error('disk'));
  };

  it('saves the whole override, then applies it to the open song', async () => {
    const { deps, calls, edits } = editor();
    await edits.edit({ kind: 'barOne', seconds: 1.5 });
    const expected = { meterBeatsPerBar: null, barOneSeconds: 1.5 };
    expect(deps.save).toHaveBeenCalledWith(SET, expected);
    expect(deps.applied).toHaveBeenCalledWith(SET, expected);
    expect(calls).toEqual(['save', 'applied']);
  });

  it('offers Undo back to the override it replaced', async () => {
    const { edits } = editor(YOURS);
    const notice = await edits.edit({ kind: 'reset' });
    expect(notice?.actionLabel).toBe('Undo');
    expect(notice?.restore).toEqual({ setId: SET, override: YOURS });
  });

  it('says where bar one moved to', async () => {
    const { edits } = editor();
    const notice = await edits.edit({ kind: 'barOne', seconds: 105.3 });
    expect(notice?.message).toBe('Bar 1 moved to 1:45.3. Saved for this song.');
  });

  it('names the meter it set', async () => {
    const { edits } = editor();
    const notice = await edits.edit({ kind: 'meter', meter: TRIPLE });
    expect(notice?.message).toBe('Meter set to 3/4. Saved for this song.');
  });

  it('says the detected values are back', async () => {
    const { edits } = editor(YOURS);
    const notice = await edits.edit({ kind: 'reset' });
    expect(notice?.message).toBe(
      'Using the detected meter and bar 1. Saved for this song.',
    );
  });

  it('saves nothing for an edit that changes nothing', async () => {
    const { deps, edits } = editor();
    expect(await edits.edit({ kind: 'reset' })).toBeNull();
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.applied).not.toHaveBeenCalled();
  });

  it('builds the second of two quick edits on the first', async () => {
    const { deps, edits } = editor();
    const first = held();
    deps.save.mockReturnValueOnce(first.gate);
    const meter = edits.edit({ kind: 'meter', meter: TRIPLE });
    const barOne = edits.edit({ kind: 'barOne', seconds: 1 });
    first.release();
    await Promise.all([meter, barOne]);
    expect(deps.save).toHaveBeenLastCalledWith(SET, YOURS);
    expect(deps.applied).toHaveBeenLastCalledWith(SET, YOURS);
  });

  it('applies nothing and offers to try the same save again when it fails', async () => {
    const { deps, edits } = editor();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    failOnce(deps);
    const notice = await edits.edit({ kind: 'meter', meter: TRIPLE });
    expect(deps.applied).not.toHaveBeenCalled();
    expect(notice).toMatchObject<Partial<MeterNotice>>({
      message: NOT_SAVED,
      actionLabel: 'Try again',
      restore: { setId: SET, override: TRIPLE_ONLY },
    });
    warn.mockRestore();
  });

  it('offers Undo once Try again saves the edit', async () => {
    const { deps, edits } = editor();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    failOnce(deps);
    const failed = await edits.edit({ kind: 'meter', meter: TRIPLE });
    if (failed === null) throw new Error('no notice');
    const saved = await edits.act(failed);
    expect(deps.applied).toHaveBeenCalledWith(SET, TRIPLE_ONLY);
    expect(saved?.actionLabel).toBe('Undo');
    expect(saved?.restore).toEqual({ setId: SET, override: NO_METER_OVERRIDE });
    warn.mockRestore();
  });

  it('puts the replaced override back on Undo, with no further Undo', async () => {
    const { deps, edits } = editor();
    const undo = await edits.edit({ kind: 'meter', meter: TRIPLE });
    if (undo === null) throw new Error('no notice');
    expect(await edits.act(undo)).toBeNull();
    expect(deps.applied).toHaveBeenLastCalledWith(SET, NO_METER_OVERRIDE);
  });

  it('offers to try again when Undo cannot be saved', async () => {
    const { deps, edits } = editor();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const undo = await edits.edit({ kind: 'meter', meter: TRIPLE });
    if (undo === null) throw new Error('no notice');
    failOnce(deps);
    const notice = await edits.act(undo);
    expect(deps.applied).toHaveBeenLastCalledWith(SET, TRIPLE_ONLY);
    expect(notice?.actionLabel).toBe('Try again');
    expect(notice?.restore).toEqual({
      setId: SET,
      override: NO_METER_OVERRIDE,
    });
    warn.mockRestore();
  });
});
