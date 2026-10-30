import {
  KB_DENOMINATORS,
  KB_MAX_BEATS,
  KB_POLY_BEATS_BOUNDS,
  type KB_ACCENT,
} from '@kitbag/core-native';
import {
  accentsOf,
  cycleAccentValue,
  DEFAULT_POLY_BEATS,
  DEFAULT_TRAINER_BARS,
  initialAccents,
  perAccentSoundsOf,
  rampUnitOf,
  resizeAccents,
  toBlob,
  type BarMuteConfig,
  type PerAccentSounds,
  type PresetEdit,
  type RampConfig,
  type SongPreset,
} from '@kitbag/core-state';

import { MIN_BEATS } from './meter.ts';

export type RampDraft = RampConfig;
export type BarMuteDraft = BarMuteConfig;

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
  readonly perAccentSounds: PerAccentSounds;
  readonly countInBars: number;
  readonly ramp: RampDraft;
  readonly barMute: BarMuteDraft;
}

function clampTo(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function polyAccentsOf(preset: SongPreset, polyBeats: number): KB_ACCENT[] {
  const saved = accentsOf(preset.polyAccents);
  const defaults = initialAccents(polyBeats);
  return defaults.map((fallback, index) => saved[index] ?? fallback);
}

function rampDraftOf(preset: SongPreset): RampDraft {
  return {
    enabled: preset.rampEnabled,
    startBpm: preset.rampStartBpm ?? preset.bpm,
    targetBpm: preset.rampEndBpm ?? preset.bpm,
    stepBpm: preset.rampStep,
    interval: preset.rampLength ?? DEFAULT_TRAINER_BARS,
    unit: rampUnitOf(preset.rampUnit),
    loop: preset.rampLoop,
  };
}

export function draftFrom(preset: SongPreset): PresetDraft {
  const polyBeats =
    preset.polyBeats >= KB_POLY_BEATS_BOUNDS.min
      ? preset.polyBeats
      : DEFAULT_POLY_BEATS;
  return {
    name: preset.name,
    notes: preset.notes ?? '',
    bpm: preset.bpm,
    beatsPerBar: preset.beatsPerBar,
    denominator: preset.denominator,
    subdivision: preset.subdivision,
    accents: accentsOf(preset.accents),
    polyAccents: polyAccentsOf(preset, polyBeats),
    polyEnabled: preset.polyEnabled,
    polyBeats,
    sound: preset.sound,
    perAccentSounds: perAccentSoundsOf(preset.perAccentSounds, preset.sound),
    countInBars: preset.countInBars,
    ramp: rampDraftOf(preset),
    barMute: {
      enabled: preset.barMuteEnabled,
      playBars: preset.barMutePlayBars ?? DEFAULT_TRAINER_BARS,
      muteBars: preset.barMuteMuteBars ?? DEFAULT_TRAINER_BARS,
    },
  };
}

function trainerEdit({ ramp, barMute }: PresetDraft): PresetEdit {
  return {
    rampEnabled: ramp.enabled,
    rampStartBpm: ramp.startBpm,
    rampEndBpm: ramp.targetBpm,
    rampStep: ramp.stepBpm,
    rampLength: ramp.interval,
    rampUnit: ramp.unit,
    rampLoop: ramp.loop,
    barMuteEnabled: barMute.enabled,
    barMutePlayBars: barMute.playBars,
    barMuteMuteBars: barMute.muteBars,
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
  const beats = clampTo(draft.beatsPerBar + delta, MIN_BEATS, KB_MAX_BEATS);
  const accents = resizeAccents(draft.accents, beats);
  return { ...draft, beatsPerBar: beats, accents };
}

export function withPolyBeats(draft: PresetDraft, delta: number): PresetDraft {
  const polyBeats = clampTo(
    draft.polyBeats + delta,
    KB_POLY_BEATS_BOUNDS.min,
    KB_POLY_BEATS_BOUNDS.max,
  );
  const polyAccents = resizeAccents(draft.polyAccents, polyBeats);
  return { ...draft, polyBeats, polyAccents };
}

export function withNextDenominator(draft: PresetDraft): PresetDraft {
  const index = KB_DENOMINATORS.indexOf(
    draft.denominator as (typeof KB_DENOMINATORS)[number],
  );
  const next = KB_DENOMINATORS[(index + 1) % KB_DENOMINATORS.length];
  return next === undefined ? draft : { ...draft, denominator: next };
}

export function withCycledAccent(
  draft: PresetDraft,
  beat: number,
): PresetDraft {
  const accents = draft.accents.map((accent, index) =>
    index === beat ? cycleAccentValue(accent) : accent,
  );
  return { ...draft, accents };
}

export function withCycledPolyAccent(
  draft: PresetDraft,
  beat: number,
): PresetDraft {
  const polyAccents = draft.polyAccents.map((accent, index) =>
    index === beat ? cycleAccentValue(accent) : accent,
  );
  return { ...draft, polyAccents };
}
