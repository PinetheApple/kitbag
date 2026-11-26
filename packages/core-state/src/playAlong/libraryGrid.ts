import {
  meterOverrideOf,
  MS_PER_SECOND,
  type SongLibraryRepository,
} from '@kitbag/core-db';
import { KB_RESULT, type MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { BPM_BOUNDS, clamp } from '../metronome/config.ts';
import { NO_GRID, recordGrid } from '../songPlayer/songGrid.ts';
import { usableDownbeats } from '../stemPlayer/bars.ts';
import { clickGrid } from '../stemPlayer/loop.ts';
import {
  overrideDownbeats,
  type DetectedGrid,
} from '../stemPlayer/meterOverride.ts';
import { effectiveGrid } from '../stemPlayer/tempoGrid.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import { chosenSession } from './libraryOffer.ts';
import {
  LOCK_REFUSAL,
  LOCKED_OUTCOME,
  refused,
  type LockOutcome,
} from './lockOutcome.ts';
import type { PlayAlongCommands, PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongLock, PlayAlongStore } from './store.ts';
import { trackOf } from './track.ts';

export type LibraryGridReader = Pick<
  SongLibraryRepository,
  'readSong' | 'readStemSet'
>;

const GRID_ANCHOR_FRAME = 0;

async function storedGrid(
  library: LibraryGridReader,
  { kind, id }: LibraryMatch,
): Promise<DetectedGrid> {
  if (kind === 'song') {
    const song = await library.readSong(id);
    return song === undefined ? NO_GRID : recordGrid(song);
  }
  const stems = await library.readStemSet(id);
  if (stems === undefined) return NO_GRID;
  const grid = effectiveGrid(stems);
  return {
    beats: grid.beats,
    downbeatIndices: overrideDownbeats(grid, meterOverrideOf(stems)),
  };
}

export async function readLibraryGrid(
  library: LibraryGridReader,
  match: LibraryMatch,
): Promise<DetectedGrid> {
  const { beats, downbeatIndices } = await storedGrid(library, match);
  const clicked = clickGrid(beats);
  return {
    beats: clicked,
    downbeatIndices: usableDownbeats(downbeatIndices, clicked.length),
  };
}

export function firstDownbeatSec({
  beats,
  downbeatIndices,
}: DetectedGrid): number {
  return beats[downbeatIndices[0] ?? 0] ?? 0;
}

type GridCommands = Pick<
  PlayAlongCommands,
  'setGrid' | 'clearGrid' | 'metronomeAnchorGrid'
>;

export function gridLink(commands: GridCommands) {
  let sent: DetectedGrid | undefined;
  let ready = false;
  let generation = 0;
  return {
    holds: (grid: DetectedGrid) => sent === grid,
    send: (grid: DetectedGrid, onReady: () => void) => {
      const mine = ++generation;
      sent = grid;
      ready = false;
      const settle = (result: number) => {
        if (mine !== generation || result !== KB_RESULT.KB_OK) return;
        ready = true;
        onReady();
      };
      void commands
        .setGrid(grid.beats, grid.downbeatIndices, GRID_ANCHOR_FRAME)
        .then(settle, () => undefined);
    },
    anchor: (songMs: number, frame: number, rate: number): boolean => {
      if (!ready) return false;
      commands.metronomeAnchorGrid(songMs / MS_PER_SECOND, frame, rate);
      return true;
    },
    drop: () => {
      if (sent === undefined) return;
      generation++;
      sent = undefined;
      ready = false;
      commands.clearGrid();
    },
  };
}

type LockOn = (seen: MediaSessionSnapshot, lock: PlayAlongLock) => void;

export function acceptAction(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  lockOn: LockOn,
) {
  return async (): Promise<LockOutcome> => {
    const { offer } = getState();
    if (offer === undefined) return refused(LOCK_REFUSAL.noOffer);
    const grid = await runtime.readGrid(offer.match).catch(() => NO_GRID);
    const seen = chosenSession(runtime);
    if (getState().offer !== offer || seen === undefined)
      return refused(LOCK_REFUSAL.noOffer);
    if (grid.beats.length === 0) return refused(LOCK_REFUSAL.noGrid);
    const bpm = clamp(offer.match.bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
    setState({ bpm });
    lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: firstDownbeatSec(grid),
      bpm,
      lockedAtBoottimeMs: runtime.boottimeNowMs(),
      grid,
    });
    return LOCKED_OUTCOME;
  };
}
