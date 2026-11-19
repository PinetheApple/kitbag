import { describe, expect, it } from 'vitest';

import { swipeActivation, swipeDeletes, swipeOffset } from './swipeDelete.ts';

const WIDTH = 411;

describe('swipe to delete', () => {
  it('moves the row only in the chosen direction', () => {
    expect(swipeOffset(-132, 'left')).toBe(-132);
    expect(swipeOffset(132, 'left')).toBe(0);
    expect(swipeOffset(132, 'right')).toBe(132);
    expect(swipeOffset(-132, 'right')).toBe(0);
  });

  it('deletes past half the row width and springs back short of it', () => {
    expect(swipeDeletes(-206, WIDTH, 'left')).toBe(true);
    expect(swipeDeletes(-200, WIDTH, 'left')).toBe(false);
    expect(swipeDeletes(206, WIDTH, 'right')).toBe(true);
  });

  it('never deletes on a swipe the other way', () => {
    expect(swipeDeletes(400, WIDTH, 'left')).toBe(false);
    expect(swipeDeletes(-400, WIDTH, 'right')).toBe(false);
  });

  it('activates only once the finger heads the chosen way', () => {
    const [leftStart, leftEnd] = swipeActivation('left', 10);
    const [rightStart, rightEnd] = swipeActivation('right', 10);
    expect(leftStart).toBe(-10);
    expect(leftEnd).toBeGreaterThan(WIDTH);
    expect(rightEnd).toBe(10);
    expect(rightStart).toBeLessThan(-WIDTH);
  });
});
