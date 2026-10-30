import { describe, expect, it } from 'vitest';

import type { BpmBounds } from './bpmBounds.ts';
import {
  confirmEntry,
  openEntry,
  pressDigit,
  type NumpadEntry,
} from './numpad.ts';
import { RAMP_BPM_ENTRY, withRampBpm, type RampBpmField } from './rampEntry.ts';

const BOUNDS: BpmBounds = { min: 20, max: 400 };
const RAMP = { startBpm: 100, targetBpm: 140, loop: false };

const typeInto = (field: RampBpmField, digits: readonly number[]) => {
  const entry = digits.reduce<NumpadEntry>(
    (current, digit) => pressDigit(current, digit, BOUNDS),
    openEntry(RAMP[field]),
  );
  const typed = confirmEntry(entry, BOUNDS);
  return typed === undefined ? RAMP : withRampBpm(RAMP, field, typed);
};

describe('typing a ramp tempo', () => {
  it('sets only the field the numpad opened for', () => {
    expect(typeInto('startBpm', [8, 0])).toEqual({ ...RAMP, startBpm: 80 });
    expect(typeInto('targetBpm', [1, 6, 0])).toEqual({
      ...RAMP,
      targetBpm: 160,
    });
  });

  it('clamps out-of-range entries to the main tempo bounds', () => {
    expect(typeInto('startBpm', [5]).startBpm).toBe(BOUNDS.min);
    expect(typeInto('targetBpm', [9, 9, 9]).targetBpm).toBe(BOUNDS.max);
  });

  it('keeps the opening value when confirmed untouched', () => {
    expect(typeInto('targetBpm', [])).toEqual(RAMP);
  });

  it('titles each entry so a screen reader can tell them apart', () => {
    expect(RAMP_BPM_ENTRY.startBpm.title).toBe('Ramp from');
    expect(RAMP_BPM_ENTRY.targetBpm.title).toBe('Ramp to');
  });
});
