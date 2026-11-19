import { MS_PER_SECOND, type LoggedSettings } from '@kitbag/core-db';
import { countLabel } from '@kitbag/core-design';
import { KB_RAMP_UNIT } from '@kitbag/core-native';
import {
  formatClockSeconds,
  SECONDS_PER_MINUTE,
  type TimelineStretch,
} from '@kitbag/core-state';

import { bpmText } from './historyText.ts';

const RAMP_UNIT_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [KB_RAMP_UNIT.KB_RAMP_BARS]: ['bar', 'bars'],
  [KB_RAMP_UNIT.KB_RAMP_SECONDS]: ['second', 'seconds'],
  [KB_RAMP_UNIT.KB_RAMP_MINUTES]: ['minute', 'minutes'],
};

const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;

export function playClock(ms: number): string {
  return formatClockSeconds(ms / MS_PER_SECOND);
}

export function pauseText(ms: number): string {
  const length =
    ms < MS_PER_MINUTE
      ? `${String(Math.round(ms / MS_PER_SECOND))} s`
      : `${String(Math.round(ms / MS_PER_MINUTE))} min`;
  return `Paused · ${length}`;
}

export function positionText(
  position: number | null,
  total: number | undefined,
): string | null {
  if (position === null) return null;
  return total === undefined
    ? String(position)
    : `${String(position)} of ${String(total)}`;
}

function rampText(settings: LoggedSettings): string {
  const from = settings.rampStartBpm ?? settings.bpm;
  const to = settings.rampEndBpm ?? settings.bpm;
  const range = `Ramp ${String(from)} → ${bpmText(to)}`;
  const words = RAMP_UNIT_WORDS[settings.rampUnit];
  if (settings.rampLength === null || words === undefined) return range;
  const every = countLabel(settings.rampLength, ...words);
  return `${range}, +${String(settings.rampStep)} every ${every}`;
}

export function tempoText(entry: TimelineStretch): string {
  const { settings } = entry.stretch;
  if (settings?.rampEnabled === true) return rampText(settings);
  const changes = entry.tempoChanges.map(
    ({ atMs, bpm }) => `${String(Math.round(bpm))} from ${playClock(atMs)}`,
  );
  return [bpmText(entry.startBpm), ...changes].join(', ');
}
