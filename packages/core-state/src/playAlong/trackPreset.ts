import type { SongPreset, SongPresetRepository } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import {
  accentsOf,
  perAccentSoundsOf,
  presetFromMetronome,
} from '../library/presetMapping.ts';
import { initialConfig } from '../metronome/store.ts';
import { sameSong } from '../tempoLadder/store.ts';
import { chosenSession } from './libraryOffer.ts';
import {
  identityOf,
  presetForTrack,
  sameIdentity,
  type TrackIdentity,
} from './presetLookup.ts';
import type { PlayAlongPattern } from './pattern.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongStore } from './store.ts';
import { findSession, sameTrack, songOf } from './track.ts';

export const SAVE_REFUSAL = {
  notLocked: 'not-locked',
  noTrackIdentity: 'no-track-identity',
  writeFailed: 'write-failed',
} as const;

export type SaveRefusal = (typeof SAVE_REFUSAL)[keyof typeof SAVE_REFUSAL];

export type SaveOutcome =
  | { readonly saved: true }
  | { readonly saved: false; readonly reason: SaveRefusal };

export interface TrackPresetState {
  readonly hasSavedPreset: boolean;
}

export interface TrackPresetActions {
  readonly saveForTrack: () => Promise<SaveOutcome>;
}

export type TrackPresets = Pick<
  SongPresetRepository,
  'list' | 'create' | 'update' | 'forLibrarySong' | 'saveForLibrarySong'
>;

const SAVED: SaveOutcome = { saved: true };

const refusedSave = (reason: SaveRefusal): SaveOutcome => ({
  saved: false,
  reason,
});

function patternFields(pattern: PlayAlongPattern, phaseOffsetMs: number) {
  const fields = presetFromMetronome({ ...initialConfig(), ...pattern });
  return {
    beatsPerBar: fields.beatsPerBar,
    denominator: fields.denominator,
    subdivision: fields.subdivision,
    accents: fields.accents,
    perAccentSounds: fields.perAccentSounds,
    sound: fields.sound,
    phaseNudge: phaseOffsetMs,
  };
}

const newPreset = (
  identity: TrackIdentity,
  pattern: PlayAlongPattern,
  phaseOffsetMs: number,
) => ({
  ...presetFromMetronome({ ...initialConfig(), ...pattern }),
  phaseNudge: phaseOffsetMs,
  bpm: null,
  name: identity.song.title,
  title: identity.song.title,
  artist: identity.song.artist,
  source: identity.source,
  lengthSeconds: identity.lengthSeconds,
});

export function trackPresets(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
) {
  let recalledFor: TrackIdentity | undefined;
  let appliedId: number | undefined;
  let savedPhaseMs: number | undefined;
  let saving: Promise<SaveOutcome> = Promise.resolve(SAVED);

  const linkedSongId = (seen: MediaSessionSnapshot) => {
    const { track, libraryMatch } = runtime.ladder().getState();
    if (libraryMatch?.kind !== 'song' || !sameSong(track, songOf(seen)))
      return undefined;
    return libraryMatch.id;
  };

  const presetFor = (identity: TrackIdentity, songId: number | undefined) =>
    presetForTrack(runtime.presets(), identity, songId);

  const write = async (
    seen: MediaSessionSnapshot,
    identity: TrackIdentity,
    phaseOffsetMs: number,
  ) => {
    const { pattern } = getState();
    const presets = runtime.presets();
    const songId = linkedSongId(seen);
    const existing = await presetFor(identity, songId);
    if (existing !== undefined) {
      const join =
        songId !== undefined && existing.librarySongId === null
          ? { librarySongId: songId }
          : {};
      await presets.update(existing.id, {
        ...patternFields(pattern, phaseOffsetMs),
        ...join,
      });
      return existing.id;
    }
    const values = newPreset(identity, pattern, phaseOffsetMs);
    const created =
      songId === undefined
        ? await presets.create(values)
        : await presets.saveForLibrarySong(songId, values);
    return created.id;
  };

  const save = async (): Promise<SaveOutcome> => {
    const { lock } = getState();
    if (lock === undefined) return refusedSave(SAVE_REFUSAL.notLocked);
    const seen = findSession(
      runtime.sessions().getState().sessions,
      lock.sessionId,
    );
    if (seen === undefined || !sameTrack(lock.track, seen))
      return refusedSave(SAVE_REFUSAL.notLocked);
    const identity = identityOf(seen);
    if (identity === undefined)
      return refusedSave(SAVE_REFUSAL.noTrackIdentity);
    try {
      appliedId = await write(seen, identity, lock.phaseOffsetMs);
    } catch {
      return refusedSave(SAVE_REFUSAL.writeFailed);
    }
    savedPhaseMs = lock.phaseOffsetMs;
    setState({ hasSavedPreset: true });
    return SAVED;
  };

  const saveForTrack = () => {
    saving = saving.then(save, save);
    return saving;
  };

  const apply = (preset: SongPreset) => {
    const store = getState();
    store.setBeats(preset.beatsPerBar, preset.denominator);
    store.setSubdivision(preset.subdivision);
    store.setAccents(accentsOf(preset.accents));
    const sounds = perAccentSoundsOf(preset.perAccentSounds, preset.sound);
    store.setSounds(sounds.normal, sounds.accent);
    savedPhaseMs = preset.phaseNudge;
    appliedId = preset.id;
  };

  const recall = async (
    seen: MediaSessionSnapshot,
    identity: TrackIdentity,
  ) => {
    const preset = await presetFor(identity, linkedSongId(seen)).catch(
      () => undefined,
    );
    if (recalledFor !== identity || preset === undefined) return;
    if (preset.id !== appliedId) apply(preset);
    setState({ hasSavedPreset: true });
  };

  const onTrack = (force: boolean) => {
    const seen = chosenSession(runtime);
    const identity = seen && identityOf(seen);
    if (
      !force &&
      recalledFor !== undefined &&
      sameIdentity(recalledFor, identity)
    )
      return;
    if (!sameIdentity(recalledFor, identity)) {
      appliedId = undefined;
      savedPhaseMs = undefined;
      setState({ hasSavedPreset: false });
    }
    recalledFor = identity;
    if (seen !== undefined && identity !== undefined)
      void recall(seen, identity);
  };

  const watch = () => {
    recalledFor = undefined;
    const stopSessions = runtime.sessions().subscribe(() => {
      onTrack(false);
    });
    const stopLadder = runtime.ladder().subscribe((state, previous) => {
      if (state.libraryMatch !== previous.libraryMatch) onTrack(true);
    });
    onTrack(true);
    return () => {
      stopSessions();
      stopLadder();
    };
  };

  return { saveForTrack, watch, savedPhaseMs: () => savedPhaseMs };
}
