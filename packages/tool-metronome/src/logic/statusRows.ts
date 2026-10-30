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

function rampPart(ramp: RampConfig): string {
  return `Ramp ${String(ramp.startBpm)} → ${String(ramp.targetBpm)}`;
}

function mutePart(barMute: BarMuteConfig): string {
  return `Play ${String(barMute.playBars)}, mute ${String(barMute.muteBars)}`;
}

function rampAndMuteParts(settings: PracticeSettings): string[] {
  const parts: string[] = [];
  if (settings.ramp.enabled) parts.push(rampPart(settings.ramp));
  if (settings.barMute.enabled) parts.push(mutePart(settings.barMute));
  return parts;
}

export function armedSummary(settings: PracticeSettings): string {
  const parts = rampAndMuteParts(settings);
  if (settings.countIn.bars !== KB_COUNT_IN_OFF) {
    parts.push(`Count-in ${countInLabel(settings.countIn.bars)}`);
  }
  if (settings.polyEnabled) {
    parts.push(
      `Poly ${String(settings.polyBeats)}:${String(settings.beatsPerBar)}`,
    );
  }
  return parts.length === 0 ? NOTHING_ARMED : parts.join(' · ');
}

export function afterCountInSummary(settings: PracticeSettings): string {
  return rampAndMuteParts(settings).join(' · ');
}

export function practiceBadgeCount(settings: PracticeSettings): number {
  return [
    settings.ramp.enabled,
    settings.barMute.enabled,
    settings.countIn.bars !== KB_COUNT_IN_OFF,
    settings.polyEnabled,
  ].filter(Boolean).length;
}

export type StatusRow =
  'none' | 'countIn' | 'afterCountIn' | 'mute' | 'ramp' | 'reached';

export interface StatusRows {
  readonly first: StatusRow;
  readonly second: StatusRow;
}

export interface StatusReads {
  readonly countingIn: number;
  readonly barMutePosition: number;
  readonly rampState: number;
}

function rampRow(rampState: number): StatusRow {
  'worklet';
  if (rampState === KB_RAMP_STATE.KB_RAMP_STATE_STEPPING) return 'ramp';
  if (rampState === KB_RAMP_STATE.KB_RAMP_STATE_AT_TARGET) return 'reached';
  return 'none';
}

export function statusRows(
  reads: StatusReads,
  hasAfterCountIn: boolean,
): StatusRows {
  'worklet';
  if (reads.countingIn !== 0) {
    return {
      first: 'countIn',
      second: hasAfterCountIn ? 'afterCountIn' : 'none',
    };
  }
  const ramp = rampRow(reads.rampState);
  if (reads.barMutePosition < 0) return { first: ramp, second: 'none' };
  return { first: 'mute', second: ramp };
}

export const NO_SLOT = -1;

export function rowSlot(rows: StatusRows, row: StatusRow): number {
  'worklet';
  if (rows.first === row) return 0;
  return rows.second === row ? 1 : NO_SLOT;
}

export function rampNextText(nextBpm: number): string {
  'worklet';
  return `→ ${String(Math.round(nextBpm))}`;
}

export const TENTHS = 10;

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
  if (bars <= 0 || bar < 0 || bar >= bars) return '';
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
