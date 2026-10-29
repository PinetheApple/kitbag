import {
  KB_COUNT_IN_OFF,
  KB_RAMP_STATE,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import type {
  BarMuteConfig,
  CountInConfig,
  RampConfig,
} from '@kitbag/core-state';

import { countInLabel } from './countIn.ts';

export interface PracticeSettings {
  readonly ramp: RampConfig;
  readonly barMute: BarMuteConfig;
  readonly countIn: CountInConfig;
  readonly polyEnabled: boolean;
  readonly polyBeats: number;
  readonly beatsPerBar: number;
}

export const NOTHING_ARMED = 'Practice tools are off';

export function armedSummary(settings: PracticeSettings): string {
  const { ramp, barMute, countIn } = settings;
  const parts: string[] = [];
  if (ramp.enabled) {
    parts.push(`Ramp ${String(ramp.startBpm)} → ${String(ramp.targetBpm)}`);
  }
  if (barMute.enabled) {
    parts.push(
      `Play ${String(barMute.playBars)}, mute ${String(barMute.muteBars)}`,
    );
  }
  if (countIn.bars !== KB_COUNT_IN_OFF) {
    parts.push(`Count-in ${countInLabel(countIn.bars)}`);
  }
  if (settings.polyEnabled) {
    parts.push(
      `Poly ${String(settings.polyBeats)}:${String(settings.beatsPerBar)}`,
    );
  }
  return parts.length === 0 ? NOTHING_ARMED : parts.join(' · ');
}

export function practiceBadgeCount(settings: PracticeSettings): number {
  return [
    settings.ramp.enabled,
    settings.barMute.enabled,
    settings.countIn.bars !== KB_COUNT_IN_OFF,
    settings.polyEnabled,
  ].filter(Boolean).length;
}

export type StatusMode = 'rest' | 'countIn' | 'mute' | 'ramp' | 'reached';

export function statusMode(
  countingIn: number,
  barMutePosition: number,
  rampState: number,
): StatusMode {
  'worklet';
  if (countingIn !== 0) return 'countIn';
  if (barMutePosition >= 0) return 'mute';
  if (rampState === KB_RAMP_STATE.KB_RAMP_STATE_STEPPING) return 'ramp';
  if (rampState === KB_RAMP_STATE.KB_RAMP_STATE_AT_TARGET) return 'reached';
  return 'rest';
}

export function rampNextText(nextBpm: number): string {
  'worklet';
  return `→ ${String(Math.round(nextBpm))}`;
}

const TENTHS = 10;

export function rampRemainingText(remaining: number, unit: number): string {
  'worklet';
  if (!(remaining > 0)) return 'now';
  if (unit === KB_RAMP_UNIT.KB_RAMP_MINUTES) {
    const minutes = Math.ceil(remaining * TENTHS) / TENTHS;
    const shown = Number.isInteger(minutes)
      ? String(minutes)
      : minutes.toFixed(1);
    return `in ${shown} min`;
  }
  const whole = Math.ceil(remaining);
  if (unit === KB_RAMP_UNIT.KB_RAMP_SECONDS) return `in ${String(whole)} s`;
  return `in ${String(whole)} ${whole === 1 ? 'bar' : 'bars'}`;
}

export function ofText(index: number, total: number): string {
  'worklet';
  return `${String(index + 1)} of ${String(total)}`;
}

export function countInBarText(bar: number, bars: number): string {
  'worklet';
  return `bar ${ofText(bar, bars)}`;
}

export const CYCLE_STRIP_MAX_CELLS = 8;

export function cycleStripCells(cycle: number): number {
  return Math.min(cycle, CYCLE_STRIP_MAX_CELLS);
}

/** The cycle bar a strip cell shows: a window of cells paged by the current
 * bar once the cycle is longer than the strip. -1 when the cell is past it. */
export function cycleCellBar(
  cell: number,
  position: number,
  cycle: number,
): number {
  'worklet';
  const page =
    cycle <= CYCLE_STRIP_MAX_CELLS
      ? 0
      : Math.floor(Math.max(0, position) / CYCLE_STRIP_MAX_CELLS);
  const bar = page * CYCLE_STRIP_MAX_CELLS + cell;
  return bar < cycle ? bar : -1;
}

export type CountSquare = 'done' | 'now' | 'upcoming';

export function countSquare(beat: number, currentBeat: number): CountSquare {
  'worklet';
  if (beat < currentBeat) return 'done';
  return beat === currentBeat ? 'now' : 'upcoming';
}
