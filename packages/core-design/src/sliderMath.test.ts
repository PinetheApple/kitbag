import { describe, expect, it } from 'vitest';

import {
  dragTarget,
  pastWarning,
  releaseTarget,
  snapToDetent,
} from './sliderMath.ts';

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

describe('slider detent', () => {
  const detent = { at: 0.5, reach: 0.03 };

  it('catches the thumb anywhere within reach of the detent', () => {
    expect(snapToDetent(0.48, detent)).toBe(0.5);
    expect(snapToDetent(0.525, detent)).toBe(0.5);
  });

  it('lets the thumb go once it is past the reach', () => {
    expect(snapToDetent(0.46, detent)).toBe(0.46);
    expect(snapToDetent(0.54, detent)).toBe(0.54);
  });

  it('leaves a slider without a detent alone', () => {
    expect(snapToDetent(0.49, undefined)).toBe(0.49);
  });
});

describe('slider warning fill', () => {
  it('warns only past the threshold', () => {
    expect(pastWarning(0.75, 0.75)).toBe(false);
    expect(pastWarning(0.76, 0.75)).toBe(true);
    expect(pastWarning(0.9, undefined)).toBe(false);
  });
});
