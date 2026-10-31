import { describe, expect, it } from 'vitest';

import {
  dropTarget,
  neighbourShift,
  NO_DRAG,
  reorderTarget,
  slotShift,
} from './dragReorder.ts';

describe('reorderTarget', () => {
  it('moves by whole rows of drag and clamps to the list', () => {
    expect(reorderTarget(0, 95, 48, 4)).toBe(2);
    expect(reorderTarget(3, -30, 48, 4)).toBe(2);
    expect(reorderTarget(1, 500, 48, 4)).toBe(3);
    expect(reorderTarget(1, -500, 48, 4)).toBe(0);
  });

  it('stays put for a short drag or an unmeasured row', () => {
    expect(reorderTarget(2, 20, 48, 4)).toBe(2);
    expect(reorderTarget(2, 200, 0, 4)).toBe(2);
  });
});

describe('dropTarget', () => {
  it('moves to the row a completed drag ends over', () => {
    expect(dropTarget(0, 95, 48, 4, true)).toBe(2);
  });

  it('moves nothing when the drag was cancelled, however far it went', () => {
    expect(dropTarget(0, 95, 48, 4, false)).toBeNull();
  });

  it('moves nothing when a completed drag ends on its own row', () => {
    expect(dropTarget(2, 20, 48, 4, true)).toBeNull();
  });
});

const PITCH = 60;
const shifts = (from: number, target: number) =>
  [0, 1, 2, 3].map((index) => neighbourShift(index, from, target, PITCH));

describe('neighbourShift', () => {
  it('moves nothing while no row is dragged', () => {
    expect(shifts(NO_DRAG, NO_DRAG)).toEqual([0, 0, 0, 0]);
  });

  it('lifts the rows between start and target when dragging down', () => {
    expect(shifts(0, 2)).toEqual([0, -PITCH, -PITCH, 0]);
  });

  it('drops the rows between target and start when dragging up', () => {
    expect(shifts(3, 1)).toEqual([0, PITCH, PITCH, 0]);
  });

  it('leaves every row in place while the drag is over its own row', () => {
    expect(shifts(2, 2)).toEqual([0, 0, 0, 0]);
  });
});

describe('slotShift', () => {
  it("puts the dragged row's slot at the target", () => {
    expect(slotShift(1, 1, 3, PITCH)).toBe(2 * PITCH);
    expect(slotShift(2, 2, 0, PITCH)).toBe(-2 * PITCH);
  });

  it('gives other rows and an idle list no slot offset', () => {
    expect(slotShift(0, 1, 3, PITCH)).toBe(0);
    expect(slotShift(1, NO_DRAG, NO_DRAG, PITCH)).toBe(0);
  });
});
