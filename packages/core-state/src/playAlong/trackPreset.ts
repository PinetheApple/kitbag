import type { SongPreset, SongPresetRepository } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import {
  accentsOf,
  perAccentSoundsOf,
  presetFromMetronome,
  toBlob,
} from '../library/presetMapping.ts';
import { initialConfig } from '../metronome/store.ts';
import { sameSong } from '../tempoLadder/store.ts';
import { chosenSession } from './libraryOffer.ts';
import type { PlayAlongPattern } from './pattern.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongStore } from './store.ts';
import { songOf } from './track.ts';

export const SAVE_REFUSAL = {
  notLocked: 'not-locked',
  writeFailed: 'write-failed',
} as const;

export type SaveRefusal = (typeof SAVE_REFUSAL)[keyof typeof SAVE_REFUSAL];

export type SaveOutcome =
  | { readonly saved: true }
  | { readonly saved: false; readonly reason: SaveRefusal };

export interface TrackPresetState {
  readonly savedForTrack: boolean;
}

export interface TrackPresetActions {
  readonly saveForTrack: () => Promise<SaveOutcome>;
}

export type TrackPresets = Pick<
  SongPresetRepository,
  'list' | 'create' | 'update' | 'forLibrarySong' | 'saveForLibrarySong'
>;

type PatternSetters = Pick<
  PlayAlongStore,
  'setBeats' | 'setSubdivision' | 'setAccents' | 'setSounds'
>;

const SAVED: SaveOutcome = { saved: true };

const refusedSave = (reason: SaveRefusal): SaveOutcome => ({
  saved: false,
  reason,
});

const patternFields = (pattern: PlayAlongPattern, phaseOffsetMs: number) => ({
  beatsPerBar: pattern.beatsPerBar,
  denominator: pattern.denominator,
  subdivision: pattern.subdivision,
  accents: toBlob(pattern.accents),
  perAccentSounds: toBlob([pattern.sounds.normal, pattern.sounds.accent]),
  sound: pattern.sounds.normal,
  phaseNudge: phaseOffsetMs,
});

function newPreset(
  seen: MediaSessionSnapshot,
  pattern: PlayAlongPattern,
  phaseOffsetMs: number,
) {
  const song = songOf(seen);
  return {
    ...presetFromMetronome({ ...initialConfig(), ...pattern }),
    ...patternFields(pattern, phaseOffsetMs),
    bpm: null,
    name: song.title,
    title: song.title,
    artist: song.artist,
  };
}

const matchesTrack = (preset: SongPreset, seen: MediaSessionSnapshot) =>
  preset.title !== null &&
  sameSong({ title: preset.title, artist: preset.artist ?? '' }, songOf(seen));

export function trackPresets(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  setters: () => PatternSetters,
) {
  let recalledFor: MediaSessionSnapshot | undefined;
  let savedPhaseMs: number | undefined;

  const linkedSongId = (seen: MediaSessionSnapshot) => {
    const { track, libraryMatch } = runtime.ladder().getState();
    if (libraryMatch?.kind !== 'song' || !sameSong(track, songOf(seen)))
      return undefined;
    return libraryMatch.id;
  };

  const presetFor = async (seen: MediaSessionSnapshot) => {
    const presets = runtime.presets();
    const songId = linkedSongId(seen);
    const linked =
      songId === undefined ? undefined : await presets.forLibrarySong(songId);
    if (linked !== undefined) return linked;
    return (await presets.list()).find((preset) => matchesTrack(preset, seen));
  };

  const write = async (seen: MediaSessionSnapshot, phaseOffsetMs: number) => {
    const { pattern } = getState();
    const presets = runtime.presets();
    const existing = await presetFor(seen);
    if (existing !== undefined) {
      await presets.update(existing.id, patternFields(pattern, phaseOffsetMs));
      return;
    }
    const values = newPreset(seen, pattern, phaseOffsetMs);
    const songId = linkedSongId(seen);
    if (songId === undefined) await presets.create(values);
    else await presets.saveForLibrarySong(songId, values);
  };

  const saveForTrack = async (): Promise<SaveOutcome> => {
    const { lock } = getState();
    const seen = chosenSession(runtime);
    if (lock === undefined || seen === undefined)
      return refusedSave(SAVE_REFUSAL.notLocked);
    try {
      await write(seen, lock.phaseOffsetMs);
    } catch {
      return refusedSave(SAVE_REFUSAL.writeFailed);
    }
    savedPhaseMs = lock.phaseOffsetMs;
    setState({ savedForTrack: true });
    return SAVED;
  };

  const apply = (preset: SongPreset) => {
    const pattern = setters();
    pattern.setBeats(preset.beatsPerBar, preset.denominator);
    pattern.setSubdivision(preset.subdivision);
    pattern.setAccents(accentsOf(preset.accents));
    const sounds = perAccentSoundsOf(preset.perAccentSounds, preset.sound);
    pattern.setSounds(sounds.normal, sounds.accent);
    savedPhaseMs = preset.phaseNudge;
  };

  const recall = async () => {
    const seen = chosenSession(runtime);
    if (seen === undefined) return;
    if (
      recalledFor !== undefined &&
      sameSong(songOf(recalledFor), songOf(seen))
    )
      return;
    recalledFor = seen;
    savedPhaseMs = undefined;
    setState({ savedForTrack: false });
    const preset = await presetFor(seen).catch(() => undefined);
    if (recalledFor !== seen || preset === undefined) return;
    apply(preset);
    setState({ savedForTrack: true });
  };

  const watch = () => {
    recalledFor = undefined;
    const stopSessions = runtime.sessions().subscribe(() => {
      void recall();
    });
    const stopLadder = runtime.ladder().subscribe((state, previous) => {
      if (state.libraryMatch !== previous.libraryMatch) {
        recalledFor = undefined;
        void recall();
      }
    });
    void recall();
    return () => {
      stopSessions();
      stopLadder();
    };
  };

  return { saveForTrack, watch, savedPhaseMs: () => savedPhaseMs };
}
