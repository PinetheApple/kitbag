import { countLabel } from '@kitbag/core-design';
import {
  customSoundId,
  KB_ACCENT,
  KB_COUNT_IN_BARS,
  KB_COUNT_IN_OFF,
  type KbCountInBars,
} from '@kitbag/core-native';
import {
  BUILT_IN_SOUND_NAMES,
  DEFAULT_SOUND_NAME,
  type ClickSound,
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
  countInNote: 'Arrives with count-in for songs.',
  sound: 'Sound',
  soundRole: 'Beat level',
  accents: 'Accents',
  accentsHint:
    'Tap a beat: accent, normal, mute. Your Metronome stays as you left it.',
  save: 'Save for this song',
  unsaved: 'Unsaved changes',
} as const;

export const SOUND_ROLE = { normal: 'normal', accent: 'accent' } as const;
export type SoundRole = (typeof SOUND_ROLE)[keyof typeof SOUND_ROLE];

export const SOUND_ROLE_OPTIONS = [
  { value: SOUND_ROLE.normal, label: 'Normal' },
  { value: SOUND_ROLE.accent, label: 'Accent' },
] as const;

export const SOUND_OPTIONS = BUILT_IN_SOUND_NAMES.map((label, id) => ({
  value: String(id),
  label,
}));

const NO_ACCENT = 'No accent';
const BEAT_SEPARATOR = ' · ';

export function countInOptionLabel(bars: KbCountInBars): string {
  return bars === KB_COUNT_IN_OFF ? 'Off' : countLabel(bars, 'bar', 'bars');
}

export const COUNT_IN_OPTIONS = KB_COUNT_IN_BARS.map((bars) => ({
  value: String(bars),
  label: countInOptionLabel(bars),
  disabled: true,
}));

export function clickSoundName(
  id: number,
  custom: readonly ClickSound[],
): string {
  const builtIn = BUILT_IN_SOUND_NAMES[id];
  if (builtIn !== undefined) return builtIn;
  const sound = custom.find(
    (candidate) => customSoundId(candidate.slot) === id,
  );
  return sound?.name ?? DEFAULT_SOUND_NAME;
}

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

export function clickChips(
  settings: Pick<SongPlayerStore['clickSettings'], 'sounds' | 'accents'>,
  custom: readonly ClickSound[],
): readonly ClickChip[] {
  const sound = `Click: ${clickSoundName(settings.sounds.normal, custom)}`;
  return [
    {
      group: CLICK_GROUP.countIn,
      label: SONG_CLICK_TEXT.countIn,
      spoken: `${SONG_CLICK_TEXT.countIn}. ${SONG_CLICK_TEXT.countInNote}`,
      active: false,
      muted: true,
    },
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
