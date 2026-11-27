import {
  MS_PER_SECOND,
  SAME_SONG_DURATION_TOLERANCE_SEC,
  songMatchKey,
  type SongIdentity,
  type SongPreset,
  type SongPresetRepository,
} from '@kitbag/core-db';
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
  readonly savedPhaseMs: number | undefined;
  readonly presetRecalled: boolean;
}

export interface TrackPresetActions {
  readonly saveForTrack: () => Promise<SaveOutcome>;
}

export type TrackPresets = Pick<
  SongPresetRepository,
  'list' | 'create' | 'update' | 'forLibrarySong' | 'saveForLibrarySong'
>;

interface TrackIdentity {
  readonly song: SongIdentity;
  readonly source: string;
  readonly lengthSeconds: number | null;
}

const SAVED: SaveOutcome = { saved: true };

const refusedSave = (reason: SaveRefusal): SaveOutcome => ({
  saved: false,
  reason,
});

function identityOf(seen: MediaSessionSnapshot): TrackIdentity | undefined {
  const song = songOf(seen);
  if (songMatchKey(song).title === '') return undefined;
  return {
    song,
    source: seen.packageName,
    lengthSeconds:
      seen.durationMs === null ? null : seen.durationMs / MS_PER_SECOND,
  };
}

function sameLength(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= SAME_SONG_DURATION_TOLERANCE_SEC;
}

const sameIdentity = (
  a: TrackIdentity | undefined,
  b: TrackIdentity | undefined,
): boolean =>
  a === undefined || b === undefined
    ? a === b
    : sameSong(a.song, b.song) &&
      a.source === b.source &&
      sameLength(a.lengthSeconds, b.lengthSeconds);

const presetIdentity = (preset: SongPreset): TrackIdentity | undefined =>
  preset.title === null || preset.source === null
    ? undefined
    : {
        song: { title: preset.title, artist: preset.artist ?? '' },
        source: preset.source,
        lengthSeconds: preset.lengthSeconds,
      };

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
  let saving: Promise<SaveOutcome> = Promise.resolve(SAVED);

  const linkedSongId = (seen: MediaSessionSnapshot) => {
    const { track, libraryMatch } = runtime.ladder().getState();
    if (libraryMatch?.kind !== 'song' || !sameSong(track, songOf(seen)))
      return undefined;
    return libraryMatch.id;
  };

  const presetFor = async (
    identity: TrackIdentity,
    songId: number | undefined,
  ) => {
    const presets = runtime.presets();
    const linked =
      songId === undefined ? undefined : await presets.forLibrarySong(songId);
    if (linked !== undefined) return linked;
    return (await presets.list()).find(
      (preset) =>
        (songId === undefined || preset.librarySongId === null) &&
        sameIdentity(presetIdentity(preset), identity),
    );
  };

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
    setState({
      hasSavedPreset: true,
      savedPhaseMs: lock.phaseOffsetMs,
      presetRecalled: false,
    });
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
    if (preset.id === appliedId) {
      setState({ hasSavedPreset: true });
      return;
    }
    apply(preset);
    setState({
      hasSavedPreset: true,
      savedPhaseMs: preset.phaseNudge,
      presetRecalled: true,
    });
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
      setState({
        hasSavedPreset: false,
        savedPhaseMs: undefined,
        presetRecalled: false,
      });
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

  return {
    saveForTrack,
    watch,
    unlocked: () => {
      setState({ presetRecalled: false });
    },
  };
}
