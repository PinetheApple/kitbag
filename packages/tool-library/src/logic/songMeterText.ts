import {
  meterLabel,
  tenthsClock,
  type MeterGridState,
} from '@kitbag/core-design';
import type {
  DetectedMeter,
  MeterOverride,
  SongBadge,
} from '@kitbag/core-state';

export const METER_FAILED = 'Needs a beat grid. Re-analyse first.';
export const UNDO_LABEL = 'Undo';
export const USE_DETECTED_LABEL = 'Use detected';
export const DETECTED_RESTORED =
  'Back to the detected meter. Saved for this song.';

const SAVED = 'Saved for this song.';

export function meterGridState(badge: SongBadge): MeterGridState {
  switch (badge) {
    case 'grid':
      return 'ready';
    case 'pending':
    case 'analyzing':
      return 'pending';
    case 'failed':
    case 'noGrid':
      return 'failed';
  }
}

export function meterSetText(meter: number): string {
  return `Meter set to ${meterLabel(meter)}. ${SAVED}`;
}

export function barOneMovedText(seconds: number): string {
  return `Bar 1 moved to ${tenthsClock(seconds)}. ${SAVED}`;
}

function keptText({ meterBeatsPerBar, barOneSeconds }: MeterOverride): string {
  if (meterBeatsPerBar !== null && barOneSeconds !== null)
    return 'Your meter and bar 1 are kept.';
  return barOneSeconds === null ? 'Your meter is kept.' : 'Your bar 1 is kept.';
}

export function reanalysedText(
  detected: DetectedMeter,
  override: MeterOverride,
): string {
  const found = `${meterLabel(detected.meter)}, bar 1 at ${tenthsClock(detected.barOneSeconds)}`;
  return `Re-analysed: ${found}. ${keptText(override)}`;
}

export const PLAYER_MENU_TEXT = {
  title: 'Player',
  dismiss: 'Close the player menu',
  reanalyzeDetail: 'Find the beat again',
  countIn: 'Count-in',
  countInValue: 'Off',
  countInDetail: 'Arrives with count-in for songs',
  stop: 'Stop',
  stopDetail: 'Ends the song and the mini-player',
} as const;
