import {
  KB_MIXER_PITCH_BOUNDS,
  KB_MIXER_RATE_BOUNDS,
  KB_MIXER_UNITY_RATE,
} from '@kitbag/core-native';

import { clamp } from '../metronome/config.ts';
import { DRUMS_STEM } from './lanes.ts';

const PERCENT = 100;
const SPEED_STEP_PERCENT = 5;
const HALF_SPEED = 0.5;
const THREE_QUARTER_SPEED = 0.75;
const NEAR_FULL_SPEED = 0.9;

export const SPEED_PRESETS: readonly number[] = [
  HALF_SPEED,
  THREE_QUARTER_SPEED,
  NEAR_FULL_SPEED,
  KB_MIXER_UNITY_RATE,
];

export function speedPercent(speed: number): number {
  return Math.round(speed * PERCENT);
}

export function clampedSpeed(speed: number): number {
  return clamp(speed, KB_MIXER_RATE_BOUNDS.min, KB_MIXER_RATE_BOUNDS.max);
}

export function steppedSpeed(speed: number, steps: number): number {
  const snapped = Math.round(speedPercent(speed) / SPEED_STEP_PERCENT) + steps;
  return clampedSpeed((snapped * SPEED_STEP_PERCENT) / PERCENT);
}

export function isUnitySpeed(speed: number): boolean {
  return speedPercent(speed) === speedPercent(KB_MIXER_UNITY_RATE);
}

// Half away from zero, as the engine binding rounds a stored key.
export function wholeKey(semitones: number): number {
  const magnitude = Math.round(Math.abs(semitones));
  const signed = semitones < 0 && magnitude > 0 ? -magnitude : magnitude;
  return clamp(signed, KB_MIXER_PITCH_BOUNDS.min, KB_MIXER_PITCH_BOUNDS.max);
}

export function steppedKey(key: number, steps: number): number {
  return wholeKey(key + steps);
}

export function transposable(role: string): boolean {
  return role.trim().toLowerCase() !== DRUMS_STEM;
}
