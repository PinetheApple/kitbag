import { countLabel } from '@kitbag/core-design';
import {
  KB_ACCENT,
  KB_COUNT_IN_BARS,
  KB_COUNT_IN_OFF,
  type KbCountInBars,
} from '@kitbag/core-native';
import {
  soundLabel,
  type CustomSoundView,
  type SongPlayerStore,
} from '@kitbag/core-state';

export const CLICK_GROUP = {
  countIn: 'countIn',
  sound: 'sound',
  accents: 'accents',
} as const;
export type ClickGroup = (typeof CLICK_GROUP)[keyof typeof CLICK_GROUP];

export const SONG_CLICK_TEXT = {
  title: 'Click for this song',
  dismiss: 'Close click for this song',
  countIn: 'Count-in',
  sound: 'Sound',
  soundRole: 'Beat level',
  accents: 'Accents',
  accentsHint:
    'Tap a beat: accent, normal, mute. Your Metronome stays as you left it.',
  save: 'Save for this song',
  unsaved: 'Unsaved changes',
} as const;

const NO_ACCENT = 'No accent';
const BEAT_SEPARATOR = ' · ';

export function countInOptionLabel(bars: KbCountInBars): string {
  return bars === KB_COUNT_IN_OFF ? 'Off' : countLabel(bars, 'bar', 'bars');
}

export const COUNT_IN_OPTIONS = KB_COUNT_IN_BARS.map((bars) => ({
  value: String(bars),
  label: countInOptionLabel(bars),
}));

export function accentedBeats(accents: readonly KB_ACCENT[]): number[] {
  return accents.flatMap((accent, beat) =>
    accent === KB_ACCENT.KB_ACCENT_ACCENTED ? [beat + 1] : [],
  );
}

export interface ClickChip {
  readonly group: ClickGroup;
  readonly label: string;
  readonly spoken: string;
  readonly active: boolean;
  readonly muted: boolean;
}

function accentChip(accents: readonly KB_ACCENT[]): ClickChip {
  const beats = accentedBeats(accents);
  const label =
    beats.length === 0
      ? NO_ACCENT
      : `Accent ${beats.map(String).join(BEAT_SEPARATOR)}`;
  return {
    group: CLICK_GROUP.accents,
    label,
    spoken: `${label}, change the accents`,
    active: beats.length > 0,
    muted: false,
  };
}

type ChipSettings = Pick<
  SongPlayerStore['clickSettings'],
  'countInBars' | 'sounds' | 'accents'
>;

function countInChip(bars: KbCountInBars): ClickChip {
  const off = bars === KB_COUNT_IN_OFF;
  const label = off
    ? SONG_CLICK_TEXT.countIn
    : `${SONG_CLICK_TEXT.countIn}: ${countInOptionLabel(bars)}`;
  return {
    group: CLICK_GROUP.countIn,
    label,
    spoken: `${off ? `${label} off` : label}, change the count-in`,
    active: !off,
    muted: false,
  };
}

function songChips(
  settings: ChipSettings,
  custom: readonly CustomSoundView[],
): readonly ClickChip[] {
  const sound = `Click: ${soundLabel(settings.sounds.normal, custom)}`;
  return [
    countInChip(settings.countInBars),
    {
      group: CLICK_GROUP.sound,
      label: sound,
      spoken: `${sound}, change the click sound`,
      active: false,
      muted: false,
    },
    accentChip(settings.accents),
  ];
}

export function clickChips(
  settings: ChipSettings,
  custom: readonly CustomSoundView[],
  hasGrid: boolean,
): readonly ClickChip[] {
  const chips = songChips(settings, custom);
  if (hasGrid) return chips;
  return chips.map((chip) => ({ ...chip, active: false, muted: true }));
}
