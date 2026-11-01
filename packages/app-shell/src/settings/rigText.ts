import type { IconName } from '@kitbag/core-design';
import type { OutputRoute } from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';
import {
  accentedSlots,
  formatOffsetMs,
  isSounding,
  ON_BEAT_SLOT,
  RIG_CLICK_BPM,
  routeDetail,
  routeTitle,
  storedRoute,
  type RigClickPhase,
} from '@kitbag/core-state';

import { SEPARATOR } from './separator.ts';
import { NOT_SAVED } from './settingsLabels.ts';

const JOIN = ` ${SEPARATOR} `;

const IN_USE_NOW = 'in use now';
const UNKNOWN_OUTPUT = 'Unknown output';
const CALIBRATED = 'calibrated';
const NOT_CALIBRATED = 'not calibrated';
const NEVER_CALIBRATED = 'never calibrated';
const BEAT_SLOT = 'Beat';
const ACCENT_SLOT = 'accent';
const NORMAL_SLOT = 'normal';

const NEEDS_STOPPED_METRONOME = 'Stop the metronome to hear the rig click';
const CLICK_FAILED = 'The click could not start; try again';

export interface RigChip {
  readonly label: string;
  readonly icon: IconName;
  readonly active: boolean;
}

export function rigChip(phase: RigClickPhase): RigChip {
  const active = isSounding(phase);
  return {
    label: `${active ? 'Stop' : 'Play'}${JOIN}${String(RIG_CLICK_BPM)} BPM`,
    icon: active ? 'stop' : 'play',
    active,
  };
}

export function rigClickHint(
  phase: RigClickPhase,
  metronomeRunning: boolean,
): string | null {
  if (metronomeRunning) return NEEDS_STOPPED_METRONOME;
  if (phase === 'busy' || phase === 'failed') return CLICK_FAILED;
  return null;
}

const A11Y_JOIN = ', ';

function routeNameParts(route: OutputRoute | null): string[] {
  if (route === null) return [UNKNOWN_OUTPUT];
  const detail = routeDetail(route);
  return route.kind === 'wired' && detail !== null
    ? [routeTitle(route), detail]
    : [routeTitle(route)];
}

function routeStatus(live: OutputRoute | null, calibrated: boolean): string {
  if (live?.certain !== true) return NOT_SAVED;
  return calibrated ? CALIBRATED : NOT_CALIBRATED;
}

export interface OutputLine {
  readonly name: string;
  readonly status: string;
}

export function outputLine(
  live: OutputRoute | null,
  calibrated: boolean,
): OutputLine {
  return {
    name: routeNameParts(live).join(JOIN),
    status: `${JOIN}${routeStatus(live, calibrated)}`,
  };
}

export function outputAccessibilityLabel(
  live: OutputRoute | null,
  calibrated: boolean,
): string {
  return [...routeNameParts(live), routeStatus(live, calibrated)].join(
    A11Y_JOIN,
  );
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
