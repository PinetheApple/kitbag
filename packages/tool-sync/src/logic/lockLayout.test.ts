import { describe, expect, it } from 'vitest';

import {
  lockLayout,
  METER_PLACE,
  type LockLayoutInputs,
} from './lockLayout.ts';

const quietLock: LockLayoutInputs = {
  locked: true,
  drifting: false,
  retapping: false,
  padHeld: false,
};

describe('lockLayout', () => {
  it('keeps the pad and no meter before a lock', () => {
    expect(lockLayout({ ...quietLock, locked: false })).toEqual({
      meter: METER_PLACE.none,
      pad: true,
    });
  });

  it('gives the pad slot to the meter, last in the body, once locked', () => {
    expect(lockLayout(quietLock)).toEqual({
      meter: METER_PLACE.last,
      pad: false,
    });
  });

  it('moves the meter to the top and brings the pad back on drift', () => {
    expect(lockLayout({ ...quietLock, drifting: true })).toEqual({
      meter: METER_PLACE.first,
      pad: true,
    });
  });

  it('brings the pad back under the meter for a re-tap', () => {
    expect(lockLayout({ ...quietLock, retapping: true })).toEqual({
      meter: METER_PLACE.last,
      pad: true,
    });
  });

  it('keeps the landed pad under the finger until it lifts', () => {
    expect(lockLayout({ ...quietLock, padHeld: true })).toEqual({
      meter: METER_PLACE.none,
      pad: true,
    });
  });
});
