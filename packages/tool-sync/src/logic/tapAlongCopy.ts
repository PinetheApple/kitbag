import { FACT_SEPARATOR } from '@kitbag/core-design';
import {
  formatOffsetMs,
  MINUS,
  TAP_LOCK_MISS,
  TAP_OUTLIER_MS,
  TAPS_TO_SET_TEMPO,
  type TapAlong,
  type TapOffset,
} from '@kitbag/core-state';

import { shownBpm } from './tempoLine.ts';

export const PAD_ACTION = {
  accentRight: 'accentRight',
  startOver: 'startOver',
} as const;

export type PadAction = (typeof PAD_ACTION)[keyof typeof PAD_ACTION];

export interface TapBadgeView {
  readonly label: string;
  readonly ignored: boolean;
}

export interface AlongCopy {
  readonly title: string;
  readonly hint: string;
  readonly leds: number | null;
  readonly badges: readonly TapBadgeView[];
  readonly action: PadAction | null;
  readonly active: boolean;
}

const TENTHS = 10;
const KICK_DRUM = 'Keep tapping, or follow the kick drum.';
const SNAP_HINT =
  'Where the bar starts. Near is fine: it snaps to the closest beat.';
const FOLLOWS = 'The click follows the song from here.';

const kept = (offsets: readonly TapOffset[]) =>
  offsets.filter((offset) => offset.kept);

const litLeds = (offsets: readonly TapOffset[]) =>
  Math.min(kept(offsets).length, TAPS_TO_SET_TEMPO);

const plural = (count: number, word: string) =>
  `${String(count)} ${word}${count === 1 ? '' : 's'}`;

const tenths = (bpm: number) => String(Math.round(bpm * TENTHS) / TENTHS);

function plainSigned(ms: number): string {
  const whole = Math.round(ms);
  if (whole === 0) return '0';
  return whole < 0 ? `${MINUS}${String(-whole)}` : `+${String(whole)}`;
}

export function tapBadges(offsets: readonly TapOffset[]): TapBadgeView[] {
  const withUnit = offsets.length < TAPS_TO_SET_TEMPO;
  return offsets.map(({ ms, kept: isKept }) => {
    const shown = withUnit ? formatOffsetMs(Math.round(ms)) : plainSigned(ms);
    return { label: isKept ? shown : `${shown} ignored`, ignored: !isKept };
  });
}

function lastTap(offsets: readonly TapOffset[]): string {
  const ms = Math.round(offsets.at(-1)?.ms ?? 0);
  if (ms === 0) return 'last one on the beat';
  return `last one ${String(Math.abs(ms))} ms ${ms < 0 ? 'early' : 'late'}`;
}

const counted = (taps: number) =>
  `${String(taps)} of ${String(TAPS_TO_SET_TEMPO)} taps`;

const along = (
  title: string,
  hint: string,
  rest: Partial<AlongCopy> = {},
): AlongCopy => ({
  title,
  hint,
  leds: null,
  badges: [],
  action: null,
  active: false,
  ...rest,
});

export function idleCopy(songBpm: number | null, offered: boolean): AlongCopy {
  if (songBpm === null)
    return along(
      'Tap along to the beat',
      'Your taps set the tempo and the beat. Four or more.',
    );
  return along(
    'Tap along to the beat',
    offered
      ? 'Or tap along to lock it yourself'
      : 'Four taps or more. Start on a 1 if you can.',
  );
}

export function retapCopy(tapAlong: TapAlong, lockBpm: number): AlongCopy {
  const count = tapAlong.taps.length;
  const stays = `tempo stays ${shownBpm(lockBpm)} and the 1 stays put`;
  const lead = count === 0 ? 'Four taps or more' : counted(count);
  return along('Tap along to re-align', `${lead}${FACT_SEPARATOR}${stays}`, {
    leds: litLeds(tapAlong.offsets),
    active: count > 0,
  });
}

export function pausedCopy(tapAlong: TapAlong): AlongCopy {
  return along(
    `Paused${FACT_SEPARATOR}${plural(tapAlong.taps.length, 'tap')} kept`,
    'Taps are kept in song time. Play and carry on tapping.',
    { leds: litLeds(tapAlong.offsets) },
  );
}

function readyHint(offsets: readonly TapOffset[]): string {
  const agreeing = kept(offsets);
  const within = Math.round(Math.max(...agreeing.map((o) => Math.abs(o.ms))));
  const ignored = offsets.length - agreeing.length;
  const agree = `${String(agreeing.length)} taps agree within ${String(within)} ms`;
  return ignored === 0
    ? agree
    : `${agree}${FACT_SEPARATOR}${String(ignored)} ignored`;
}

function unevenHint(offsets: readonly TapOffset[]): string {
  const ignored = offsets.length - kept(offsets).length;
  if (ignored === 0) return KICK_DRUM;
  const off = `${String(ignored)} of ${String(offsets.length)} were more than ${String(TAP_OUTLIER_MS)} ms off.`;
  return `${off} ${KICK_DRUM}`;
}

function unsureHint(tappedBpm: number | null, songBpm: number | null): string {
  if (tappedBpm === null || songBpm === null) return KICK_DRUM;
  return `Your taps say ${shownBpm(tappedBpm)}, the song says ${shownBpm(songBpm)}. A few more will settle it.`;
}

export function tappingCopy(
  tapAlong: TapAlong,
  songBpm: number | null,
): AlongCopy {
  const { offsets, result } = tapAlong;
  const shown = {
    leds: litLeds(offsets),
    badges: tapBadges(offsets),
    active: true,
  };
  if (offsets.length < TAPS_TO_SET_TEMPO || result === undefined)
    return along(
      'Keep tapping',
      `${counted(offsets.length)}${FACT_SEPARATOR}${lastTap(offsets)}`,
      shown,
    );
  if (result.locked || result.reason === TAP_LOCK_MISS.disagrees)
    return along('Keep tapping, or stop to lock', readyHint(offsets), shown);
  if (result.reason === TAP_LOCK_MISS.unsure)
    return along('Keep tapping', unsureHint(result.tappedBpm, songBpm), shown);
  return along('Taps are uneven', unevenHint(offsets), {
    ...shown,
    action: PAD_ACTION.startOver,
  });
}

function halfOrDoubleHint(tappedBpm: number, songBpm: number): string {
  const how = tappedBpm < songBpm ? 'every other beat' : 'twice a beat';
  return `You tapped ${how} (${tenths(tappedBpm)}). That works: tempo stays ${shownBpm(songBpm)}.`;
}

export function chooseOneCopy(
  tapAlong: TapAlong,
  songBpm: number | null,
): AlongCopy {
  const hd = tapAlong.halfOrDoubleBpm;
  const hint =
    hd === undefined || songBpm === null
      ? SNAP_HINT
      : halfOrDoubleHint(hd, songBpm);
  return along('Now tap once on the 1', hint, {
    action: PAD_ACTION.accentRight,
  });
}

export function oneSetCopy(movedBeats: number): AlongCopy {
  const moved =
    movedBeats === 0 ? '' : `Moved the accent ${plural(movedBeats, 'beat')}. `;
  return along('Beat 1 is set', `${moved}${FOLLOWS}`, { active: true });
}

export function chooseTempoCopy(tapAlong: TapAlong): AlongCopy {
  const keptTaps = tapAlong.tempoChoice?.keptTaps ?? 0;
  return along(
    `Locked from ${String(keptTaps)} taps`,
    'Pick a tempo above, then tap once on the 1.',
  );
}
