import { describe, expect, it } from 'vitest';

import { dragTarget, releaseTarget } from './sliderMath.ts';

const WIDTH = 200;

describe('slider gestures', () => {
  it('leaves a fader where it is on a tap', () => {
    expect(releaseTarget('fader', 'tap', true, 0.3, 0.8)).toBeNull();
  });

  it('lets a seek bar jump to a tap', () => {
    expect(releaseTarget('seek', 'tap', true, 0.3, 0.8)).toBe(0.3);
  });

  it('sets nothing new when a drag is cancelled', () => {
    expect(releaseTarget('fader', 'pan', false, 0.3, 0.8)).toBe(0.8);
    expect(releaseTarget('seek', 'pan', false, 0.3, 0.8)).toBeNull();
    expect(releaseTarget('fader', 'pan', true, 0.3, 0.8)).toBe(0.3);
  });

  it('moves a fader by the distance dragged, not to the finger', () => {
    const touch = { x: 20, translationX: 40, width: WIDTH };
    expect(dragTarget('fader', 0.5, touch)).toBe(0.7);
    expect(dragTarget('seek', 0.5, touch)).toBe(0.1);
    expect(dragTarget('fader', 0.9, touch)).toBe(1);
  });
});
