import type { IconName } from '@kitbag/core-design';
import {
  KB_VOLUME_BOUNDS,
  type OutputRoute,
  type OutputRouteKind,
} from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import {
  accentedSlots,
  formatOffsetMs,
  isOutputRouteKind,
  ON_BEAT_SLOT,
  RIG_CLICK_BPM,
  routeDetail,
  routeTitle,
  type RigClickPhase,
} from '@kitbag/core-state';

import { SEPARATOR } from './separator.ts';

const PERCENT = 100;
const UNITY_VOLUME = 1;
const DETENT_REACH_OF_RANGE = 0.03;
const WARN_ABOVE_VOLUME = 1.5;
const ACCESSIBILITY_STEP_PERCENT = 1;
const JOIN = ` ${SEPARATOR} `;

const OTHER_KIND: OutputRouteKind = 'other';
const IN_USE_NOW = 'in use now';
const NEVER_CALIBRATED = 'never calibrated';
const BEAT_SLOT = 'Beat';
const ACCENT_SLOT = 'accent';
const NORMAL_SLOT = 'normal';

const NEEDS_STOPPED_METRONOME = 'Stop the metronome to hear the rig click';
const CLICK_FAILED = 'The click could not start; try again';

export const VOLUME_SLIDER = {
  detent: {
    at: UNITY_VOLUME / KB_VOLUME_BOUNDS.max,
    reach: DETENT_REACH_OF_RANGE,
  },
  warnAbove: WARN_ABOVE_VOLUME / KB_VOLUME_BOUNDS.max,
  step: ACCESSIBILITY_STEP_PERCENT / PERCENT / KB_VOLUME_BOUNDS.max,
} as const;

export function volumeOfFraction(fraction: number): number {
  return fraction * KB_VOLUME_BOUNDS.max;
}

export function fractionOfVolume(volume: number): number {
  return volume / KB_VOLUME_BOUNDS.max;
}

export function volumePercent(volume: number): string {
  return `${String(Math.round(volume * PERCENT))}%`;
}

export interface RigChip {
  readonly label: string;
  readonly icon: IconName;
}

export function rigChip(phase: RigClickPhase): RigChip {
  const sounding = phase === 'starting' || phase === 'playing';
  return {
    label: `${sounding ? 'Stop' : 'Play'}${JOIN}${String(RIG_CLICK_BPM)} BPM`,
    icon: sounding ? 'stop' : 'play',
  };
}

export function rigClickHint(
  phase: RigClickPhase,
  metronomeRunning: boolean,
): string | null {
  if (metronomeRunning || phase === 'busy') return NEEDS_STOPPED_METRONOME;
  if (phase === 'failed') return CLICK_FAILED;
  return null;
}

export function outputName(route: OutputRoute): string {
  const detail = routeDetail(route);
  return route.kind === 'wired' && detail !== null
    ? `${routeTitle(route)}${JOIN}${detail}`
    : routeTitle(route);
}

export function outputStatus(calibrated: boolean): string {
  return `${SEPARATOR} ${calibrated ? 'calibrated' : 'not calibrated'}`;
}

export function storedRoute(row: RouteLatency): OutputRoute {
  const kind = row.kind ?? OTHER_KIND;
  return {
    id: row.route,
    name: row.name ?? '',
    kind: isOutputRouteKind(kind) ? kind : OTHER_KIND,
    certain: true,
  };
}

export interface RouteRowView {
  readonly route: OutputRoute;
  readonly title: string;
  readonly meta: string;
  readonly offset: string;
  readonly live: boolean;
  readonly stored: boolean;
}

const capitalised = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

function rowView(
  route: OutputRoute,
  live: boolean,
  storedOffsetMs: number | undefined,
  appliedMs: number,
): RouteRowView {
  const parts = [
    routeDetail(route),
    live ? IN_USE_NOW : null,
    storedOffsetMs === undefined ? NEVER_CALIBRATED : null,
  ].filter((part) => part !== null);
  return {
    route,
    title: routeTitle(route),
    meta: capitalised(parts.join(JOIN)),
    offset: formatOffsetMs(live ? appliedMs : (storedOffsetMs ?? 0)),
    live,
    stored: storedOffsetMs !== undefined,
  };
}

export function routeRows(
  live: OutputRoute | null,
  stored: Readonly<Record<string, RouteLatency>>,
  appliedMs: number,
): RouteRowView[] {
  const others = Object.values(stored)
    .filter((row) => row.route !== live?.id)
    .map((row) => rowView(storedRoute(row), false, row.offsetMs, appliedMs))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (live === null) return others;
  return [rowView(live, true, stored[live.id]?.offsetMs, appliedMs), ...others];
}

export function accentLabels(mask: number, count: number): string {
  return accentedSlots(mask, count)
    .map((accented, slot) => {
      if (slot === ON_BEAT_SLOT) return BEAT_SLOT;
      return accented ? ACCENT_SLOT : NORMAL_SLOT;
    })
    .join(JOIN);
}
