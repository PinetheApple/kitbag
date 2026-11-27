import {
  KB_METRONOME_SLOT,
  KB_RESULT,
  type MediaSessionSnapshot,
  type PlayAlongCardRequest,
} from '@kitbag/core-native';
import { vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type {
  LinkedPresetValues,
  NewSongPreset,
  SongPreset,
} from '@kitbag/core-db';

import { NO_GRID } from '../songPlayer/songGrid.ts';
import type { DetectedGrid } from '../stemPlayer/meterOverride.ts';
import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import type {
  FollowedLadder,
  FollowedSessions,
  PlayAlongRuntime,
} from './runtime.ts';
import { createPlayAlongStore } from './store.ts';

export const START_MS = 1_000_000;
export const FRAMES_PER_MS = 48;
export const LATENCY_MS = 180;
export const SESSION_ID = 'player';
export const OTHER_ID = 'other';
export const BPM = 120;
const SETTLE_TURNS = 8;
export const PLAY_ALONG = KB_METRONOME_SLOT.KB_METRONOME_SLOT_PLAY_ALONG;
export const STANDALONE = KB_METRONOME_SLOT.KB_METRONOME_SLOT_STANDALONE;

export function snapshot(
  overrides: Partial<MediaSessionSnapshot> = {},
): MediaSessionSnapshot {
  return {
    sessionId: SESSION_ID,
    packageName: SESSION_ID,
    appLabel: SESSION_ID,
    title: 'Song',
    artist: 'Band',
    durationMs: 200_000,
    playing: true,
    positionMs: 10_000,
    positionUpdatedAtMs: START_MS,
    speed: 1,
    spokenWord: false,
    ...overrides,
  };
}

export const call = (name: string, ...args: readonly number[]) =>
  `${name}(${args.join(',')})`;

type SessionsView = ReturnType<FollowedSessions['getState']>;
type LadderView = ReturnType<FollowedLadder['getState']>;

function fakeLadder() {
  const lookUp = vi.fn((track: LadderView['track']) => {
    ladder.setState({ track, libraryMatch: null, bpm: null });
    return Promise.resolve();
  });
  const ladder = createStore<LadderView>(() => ({
    track: null,
    libraryMatch: null,
    bpm: null,
    lookUp,
    enter: vi.fn((bpm: number) => {
      ladder.setState({ bpm });
    }),
  }));
  return {
    ladder,
    lookUp,
    found: (libraryMatch: LibraryMatch | null) => {
      ladder.setState({ libraryMatch });
    },
    tempo: (bpm: number | null) => {
      ladder.setState({ bpm });
    },
  };
}

function fakeCommands(
  calls: string[],
  gridResult: number,
  downbeatsResult: () => number,
) {
  const logged =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.join(',')})`);
    };
  return {
    engineHold: vi.fn(() => {
      calls.push('engineHold()');
      return Promise.resolve<number>(KB_RESULT.KB_OK);
    }),
    engineRelease: vi.fn(logged('engineRelease')),
    metronomeSelectSlot: vi.fn(logged('metronomeSelectSlot')),
    metronomeAnchorExternal: vi.fn<
      PlayAlongRuntime['commands']['metronomeAnchorExternal']
    >(logged('metronomeAnchorExternal')),
    metronomeSetGridDownbeats: vi.fn<
      PlayAlongRuntime['commands']['metronomeSetGridDownbeats']
    >((downbeats) => {
      calls.push(`metronomeSetGridDownbeats(${downbeats.join(' ')})`);
      return Promise.resolve(downbeatsResult());
    }),
    metronomeAnchorGrid: vi.fn<
      PlayAlongRuntime['commands']['metronomeAnchorGrid']
    >(logged('metronomeAnchorGrid')),
    setGrid: vi.fn<PlayAlongRuntime['commands']['setGrid']>((beats) => {
      calls.push(`setGrid(${String(beats.length)})`);
      return Promise.resolve(gridResult);
    }),
    clearGrid: vi.fn(logged('clearGrid')),
    metronomePause: vi.fn(logged('metronomePause')),
    metronomeStart: vi.fn(logged('metronomeStart')),
    setTempo: vi.fn(logged('setTempo')),
    metronomeStop: vi.fn(logged('metronomeStop')),
    setBeats: vi.fn(logged('setBeats')),
    setAccent: vi.fn(logged('setAccent')),
    setSubdivision: vi.fn(logged('setSubdivision')),
    setSounds: vi.fn(logged('setSounds')),
    setVolume: vi.fn(logged('setVolume')),
    setLatencyOffset: vi.fn(logged('setLatencyOffset')),
    setPoly: vi.fn(logged('setPoly')),
    setBarMute: vi.fn(logged('setBarMute')),
    setRamp: vi.fn(logged('setRamp')),
    setCountIn: vi.fn(logged('setCountIn')),
    playAlongCardShow:
      vi.fn<PlayAlongRuntime['commands']['playAlongCardShow']>(),
    playAlongCardHide: vi.fn(),
  } satisfies PlayAlongRuntime['commands'];
}

export async function settle() {
  for (let turn = 0; turn < SETTLE_TURNS; turn++) await Promise.resolve();
}

export function presetShelf(rows: readonly Partial<SongPreset>[] = []) {
  const saved = new Map<number, SongPreset>();
  const row = (id: number, values: object) =>
    ({
      uuid: `preset-${String(id)}`,
      notes: null,
      phaseNudge: 0,
      source: null,
      lengthSeconds: null,
      librarySongId: null,
      ...values,
      id,
    }) as SongPreset;
  rows.forEach((values, index) => {
    saved.set(index + 1, row(index + 1, values));
  });
  const create = vi.fn((values: NewSongPreset) => {
    const preset = row(saved.size + 1, values);
    saved.set(preset.id, preset);
    return Promise.resolve(preset);
  });
  const update = vi.fn((id: number, values: Partial<NewSongPreset>) => {
    const current = saved.get(id);
    if (current !== undefined)
      saved.set(id, row(id, { ...current, ...values }));
    return Promise.resolve();
  });
  const forLibrarySong = vi.fn((songId: number) =>
    Promise.resolve(
      [...saved.values()].find((preset) => preset.librarySongId === songId),
    ),
  );
  const saveForLibrarySong = vi.fn(
    async (songId: number, values: LinkedPresetValues) => {
      const linked = await forLibrarySong(songId);
      if (linked === undefined)
        return create({ ...values, librarySongId: songId });
      await update(linked.id, values);
      return saved.get(linked.id) ?? linked;
    },
  );
  const list = vi.fn(() => Promise.resolve([...saved.values()]));
  return {
    repository: { list, create, update, forLibrarySong, saveForLibrarySong },
    rows: () => [...saved.values()],
  };
}

export function fakePlayAlong({
  sessions = [snapshot()],
  onClickStarting = () => () => undefined,
  yieldStandalone,
  grid = NO_GRID,
  gridResult = KB_RESULT.KB_OK,
  downbeatsResult = () => KB_RESULT.KB_OK,
  nowFrame = () => Date.now() * FRAMES_PER_MS,
  shelf = presetShelf(),
}: {
  readonly grid?: DetectedGrid;
  readonly gridResult?: number;
  readonly downbeatsResult?: () => number;
  readonly sessions?: readonly MediaSessionSnapshot[];
  readonly onClickStarting?: PlayAlongRuntime['onClickStarting'];
  readonly yieldStandalone?: PlayAlongRuntime['yieldStandalone'];
  readonly nowFrame?: PlayAlongRuntime['nowFrame'];
  readonly shelf?: ReturnType<typeof presetShelf>;
} = {}) {
  vi.useFakeTimers({ now: START_MS });
  const calls: string[] = [];
  const loggedYield = () => {
    calls.push('yieldStandalone()');
    return () => {
      calls.push('standaloneReturned()');
    };
  };
  const commands = fakeCommands(calls, gridResult, downbeatsResult);
  const pick = vi.fn((sessionId: string) => {
    media.setState({ chosenId: sessionId });
  });
  const media = createStore<SessionsView>(() => ({
    sessions,
    chosenId: sessions[0]?.sessionId,
    pick,
  }));
  let mapped = true;
  const frameAt = vi.fn((ms: number) => (mapped ? ms * FRAMES_PER_MS : null));
  const sessionCommand = vi.fn();
  const library = fakeLadder();
  const readGrid = vi.fn(() => Promise.resolve(grid));
  const playbackStarted = vi.fn();
  const cardListeners = new Set<(request: PlayAlongCardRequest) => void>();
  const sessionsRead = vi.fn(() => media);
  const latencyRead = vi.fn(() => LATENCY_MS);
  const runtime: PlayAlongRuntime = {
    commands,
    boottimeNowMs: () => Date.now(),
    nowFrame,
    engineFrameAtBoottimeMs: frameAt,
    sessions: sessionsRead,
    ladder: () => library.ladder,
    readGrid,
    sessionCommand,
    latencyOffsetMs: latencyRead,
    onClickStarting,
    yieldStandalone: yieldStandalone ?? loggedYield,
    onCardRequest: (listener) => {
      cardListeners.add(listener);
      return () => {
        cardListeners.delete(listener);
      };
    },
    playbackStarted,
    presets: () => shelf.repository,
  };
  return {
    store: createPlayAlongStore(runtime),
    shelf,
    sessionsRead,
    latencyRead,
    calls,
    commands,
    media,
    pick,
    sessionCommand,
    playbackStarted,
    cardPress: (action: PlayAlongCardRequest['action']) => {
      for (const listener of [...cardListeners]) listener({ action });
    },
    frameAt,
    unmap: () => {
      mapped = false;
    },
    map: () => {
      mapped = true;
    },
    report: (next: readonly MediaSessionSnapshot[]) => {
      media.setState({ sessions: next });
    },
    anchors: () => commands.metronomeAnchorExternal.mock.calls,
    grids: () => commands.setGrid.mock.calls,
    gridAnchors: () => commands.metronomeAnchorGrid.mock.calls,
    ladder: library,
    readGrid,
  };
}

export function locked(fake = fakePlayAlong()) {
  fake.store.getState().setBpm(BPM);
  fake.store.getState().tap(START_MS);
  return fake;
}

export function fakeSongCardStarts() {
  const listeners = new Set<() => void>();
  return {
    starts: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    play: () => {
      for (const listener of [...listeners]) listener();
    },
  };
}

export function metronomeCommands() {
  return {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    metronomePause: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setSubdivisionAccents: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setPolyAccent: vi.fn(),
    setPolyAgainst: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
    engineHold: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    engineRelease: vi.fn(),
  };
}
