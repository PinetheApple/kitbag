import { KB_ACCENT, KB_DENOMINATORS, KB_MAX_BEATS } from '@kitbag/core-native';
import {
  accentsOf,
  toBlob,
  type PresetEdit,
  type SongPreset,
} from '@kitbag/core-state';

export interface TrainerDraft {
  readonly enabled: boolean;
  readonly a: number;
  readonly b: number;
  readonly bars: number;
}

export interface PresetDraft {
  readonly name: string;
  readonly notes: string;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly denominator: number;
  readonly subdivision: number;
  readonly accents: readonly KB_ACCENT[];
  readonly polyAccents: readonly KB_ACCENT[];
  readonly polyEnabled: boolean;
  readonly polyBeats: number;
  readonly sound: number;
  readonly perAccentSounds: {
    readonly normal: number;
    readonly accent: number;
  };
  readonly countInBars: number;
  readonly ramp: TrainerDraft;
  readonly barMute: TrainerDraft;
}

const DEFAULT_TRAINER_BARS = 4;
const DEFAULT_POLY_BEATS = 3;
const MIN_BEATS = 1;

export function draftFrom(preset: SongPreset): PresetDraft {
  const polyBeats =
    preset.polyBeats > MIN_BEATS ? preset.polyBeats : DEFAULT_POLY_BEATS;
  const savedPolyAccents = accentsOf(preset.polyAccents);
  const savedSounds = Array.from(preset.perAccentSounds ?? []);
  return {
    name: preset.name,
    notes: preset.notes ?? '',
    bpm: preset.bpm,
    beatsPerBar: preset.beatsPerBar,
    denominator: preset.denominator,
    subdivision: preset.subdivision,
    accents: accentsOf(preset.accents),
    polyAccents: Array.from(
      { length: polyBeats },
      (_unused, index) =>
        savedPolyAccents[index] ??
        (index === 0
          ? KB_ACCENT.KB_ACCENT_ACCENTED
          : KB_ACCENT.KB_ACCENT_NORMAL),
    ),
    polyEnabled: preset.polyEnabled,
    polyBeats,
    sound: preset.sound,
    perAccentSounds: {
      normal: savedSounds[0] ?? preset.sound,
      accent: savedSounds[1] ?? preset.sound,
    },
    countInBars: preset.countInBars,
    ramp: {
      enabled: preset.rampEnabled,
      a: preset.rampStartBpm ?? preset.bpm,
      b: preset.rampEndBpm ?? preset.bpm,
      bars: preset.rampBars ?? DEFAULT_TRAINER_BARS,
    },
    barMute: {
      enabled: preset.barMuteEnabled,
      a: preset.barMutePlayBars ?? DEFAULT_TRAINER_BARS,
      b: preset.barMuteMuteBars ?? DEFAULT_TRAINER_BARS,
      bars: 0,
    },
  };
}

function trainerEdit(draft: PresetDraft): PresetEdit {
  return {
    rampEnabled: draft.ramp.enabled,
    rampStartBpm: draft.ramp.a,
    rampEndBpm: draft.ramp.b,
    rampBars: draft.ramp.bars,
    barMuteEnabled: draft.barMute.enabled,
    barMutePlayBars: draft.barMute.a,
    barMuteMuteBars: draft.barMute.b,
  };
}

export function editFrom(draft: PresetDraft): PresetEdit {
  return {
    name: draft.name.trim() === '' ? 'Untitled' : draft.name.trim(),
    notes: draft.notes.trim() === '' ? null : draft.notes,
    bpm: draft.bpm,
    beatsPerBar: draft.beatsPerBar,
    denominator: draft.denominator,
    subdivision: draft.subdivision,
    accents: toBlob(draft.accents),
    polyAccents: toBlob(draft.polyAccents),
    polyEnabled: draft.polyEnabled,
    polyBeats: draft.polyBeats,
    sound: draft.sound,
    perAccentSounds: toBlob([
      draft.perAccentSounds.normal,
      draft.perAccentSounds.accent,
    ]),
    countInBars: draft.countInBars,
    ...trainerEdit(draft),
  };
}

export function withBeats(draft: PresetDraft, delta: number): PresetDraft {
  const beats = Math.min(
    Math.max(draft.beatsPerBar + delta, MIN_BEATS),
    KB_MAX_BEATS,
  );
  const accents = Array.from(
    { length: beats },
    (_u, i) => draft.accents[i] ?? KB_ACCENT.KB_ACCENT_NORMAL,
  );
  return { ...draft, beatsPerBar: beats, accents };
}

export function withPolyBeats(draft: PresetDraft, delta: number): PresetDraft {
  const polyBeats = Math.min(
    Math.max(draft.polyBeats + delta, MIN_BEATS + 1),
    KB_MAX_BEATS,
  );
  const polyAccents = Array.from(
    { length: polyBeats },
    (_unused, index) => draft.polyAccents[index] ?? KB_ACCENT.KB_ACCENT_NORMAL,
  );
  return { ...draft, polyBeats, polyAccents };
}

export function withNextDenominator(draft: PresetDraft): PresetDraft {
  const index = KB_DENOMINATORS.indexOf(
    draft.denominator as (typeof KB_DENOMINATORS)[number],
  );
  const next = KB_DENOMINATORS[(index + 1) % KB_DENOMINATORS.length];
  return next === undefined ? draft : { ...draft, denominator: next };
}

const CYCLE: Readonly<Record<KB_ACCENT, KB_ACCENT>> = {
  [KB_ACCENT.KB_ACCENT_ACCENTED]: KB_ACCENT.KB_ACCENT_NORMAL,
  [KB_ACCENT.KB_ACCENT_NORMAL]: KB_ACCENT.KB_ACCENT_MUTED,
  [KB_ACCENT.KB_ACCENT_MUTED]: KB_ACCENT.KB_ACCENT_ACCENTED,
};

export function withCycledAccent(
  draft: PresetDraft,
  beat: number,
): PresetDraft {
  const accents = draft.accents.map((a, i) => (i === beat ? CYCLE[a] : a));
  return { ...draft, accents };
}

export function withCycledPolyAccent(
  draft: PresetDraft,
  beat: number,
): PresetDraft {
  const polyAccents = draft.polyAccents.map((accent, index) =>
    index === beat ? CYCLE[accent] : accent,
  );
  return { ...draft, polyAccents };
}
