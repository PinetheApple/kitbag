import {
  KB_METRONOME_SLOT,
  KB_RESULT,
  type MediaSessionSnapshot,
  type PlayAlongCardRequest,
} from '@kitbag/core-native';
import { vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

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

function fakeCommands(calls: string[], gridResult: number) {
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

export function fakePlayAlong({
  sessions = [snapshot()],
  onClickStarting = () => () => undefined,
  yieldStandalone,
  grid = NO_GRID,
  gridResult = KB_RESULT.KB_OK,
  nowFrame = () => Date.now() * FRAMES_PER_MS,
}: {
  readonly grid?: DetectedGrid;
  readonly gridResult?: number;
  readonly sessions?: readonly MediaSessionSnapshot[];
  readonly onClickStarting?: PlayAlongRuntime['onClickStarting'];
  readonly yieldStandalone?: PlayAlongRuntime['yieldStandalone'];
  readonly nowFrame?: PlayAlongRuntime['nowFrame'];
} = {}) {
  vi.useFakeTimers({ now: START_MS });
  const calls: string[] = [];
  const loggedYield = () => {
    calls.push('yieldStandalone()');
    return () => {
      calls.push('standaloneReturned()');
    };
  };
  const commands = fakeCommands(calls, gridResult);
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
  const runtime: PlayAlongRuntime = {
    commands,
    boottimeNowMs: () => Date.now(),
    nowFrame,
    engineFrameAtBoottimeMs: frameAt,
    sessions: () => media,
    ladder: () => library.ladder,
    readGrid,
    sessionCommand,
    latencyOffsetMs: () => LATENCY_MS,
    onClickStarting,
    yieldStandalone: yieldStandalone ?? loggedYield,
    onCardRequest: (listener) => {
      cardListeners.add(listener);
      return () => {
        cardListeners.delete(listener);
      };
    },
    playbackStarted,
  };
  return {
    store: createPlayAlongStore(runtime),
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
