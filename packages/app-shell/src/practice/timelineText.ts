import {
  MS_PER_SECOND,
  presetFieldsOfLogged,
  type LoggedCountIn,
  type LoggedSettings,
} from '@kitbag/core-db';
import { countLabel, subdivisionName } from '@kitbag/core-design';
import {
  KB_COUNT_IN_OFF,
  KB_RAMP_UNIT,
  type KbCountInBars,
} from '@kitbag/core-native';
import {
  effectivePolyAgainst,
  formatClockSeconds,
  isCountInBars,
  perAccentSoundsOf,
  polyRatioLabel,
  SECONDS_PER_MINUTE,
  soundChipLabel,
  type TimelineStretch,
} from '@kitbag/core-state';

import { SEPARATOR } from '../settings/separator.ts';
import { bpmText } from './historyText.ts';

type CustomSounds = Parameters<typeof soundChipLabel>[1];

export type CountInLabel = (bars: KbCountInBars) => string;

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
  return `Paused ${SEPARATOR} ${length}`;
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

export function stretchFacts(
  entry: TimelineStretch,
  custom: CustomSounds,
): string {
  const { settings } = entry.stretch;
  if (settings === null) return tempoText(entry);
  const sounds = perAccentSoundsOf(
    presetFieldsOfLogged(settings).perAccentSounds,
    settings.sound,
  );
  return [
    tempoText(entry),
    `${String(settings.beatsPerBar)}/${String(settings.denominator)}`,
    subdivisionName(settings.subdivision, settings.denominator),
    soundChipLabel(sounds, custom),
  ].join(` ${SEPARATOR} `);
}

function countInBadge(
  countIn: LoggedCountIn | null,
  countInLabel: CountInLabel,
): string[] {
  if (countIn === null || !isCountInBars(countIn.bars)) return [];
  if (countIn.bars === KB_COUNT_IN_OFF) return [];
  return [`Count-in ${countInLabel(countIn.bars)}`];
}

function muteBadge(settings: LoggedSettings): string[] {
  const { barMuteEnabled, barMutePlayBars, barMuteMuteBars } = settings;
  if (!barMuteEnabled || barMutePlayBars === null || barMuteMuteBars === null)
    return [];
  const cycle = barMutePlayBars + barMuteMuteBars;
  return [
    `Mute ${String(barMuteMuteBars)} of ${countLabel(cycle, 'bar', 'bars')}`,
  ];
}

function polyBadge(settings: LoggedSettings): string[] {
  if (!settings.polyEnabled) return [];
  const ratio = polyRatioLabel({
    polyBeats: settings.polyBeats,
    against: effectivePolyAgainst(settings.polyAgainst, settings.beatsPerBar),
    beatsPerBar: settings.beatsPerBar,
  });
  return [`Poly ${ratio}`];
}

export function stretchBadges(
  entry: TimelineStretch,
  countInLabel: CountInLabel,
): readonly string[] {
  const { settings, countIn } = entry.stretch;
  if (settings === null) return [];
  return [
    ...countInBadge(countIn, countInLabel),
    ...muteBadge(settings),
    ...polyBadge(settings),
  ];
}
