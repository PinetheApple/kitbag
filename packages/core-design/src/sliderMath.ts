import { clampUnit } from './clampUnit.ts';

// A seek bar jumps to the finger; a fader only moves by the distance dragged,
// so a stray tap can never change a level.
export type SliderMode = 'seek' | 'fader';
export type SliderGesture = 'tap' | 'pan';

export interface SliderTouch {
  readonly x: number;
  readonly translationX: number;
  readonly width: number;
}

export function dragTarget(
  mode: SliderMode,
  origin: number,
  touch: SliderTouch,
): number {
  'worklet';
  if (touch.width <= 0) return origin;
  if (mode === 'seek') return clampUnit(touch.x / touch.width);
  return clampUnit(origin + touch.translationX / touch.width);
}

// A fader plays its level live while dragged, so a cancelled drag puts the
// level back where it started.
export function releaseTarget(
  mode: SliderMode,
  gesture: SliderGesture,
  completed: boolean,
  target: number,
  origin: number,
): number | null {
  'worklet';
  if (gesture === 'tap') return completed && mode === 'seek' ? target : null;
  if (completed) return target;
  return mode === 'fader' ? origin : null;
}
