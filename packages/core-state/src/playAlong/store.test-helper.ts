import { KB_RESULT, type MediaSessionSnapshot } from '@kitbag/core-native';
import { vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import type { FollowedSessions, PlayAlongRuntime } from './runtime.ts';
import { createPlayAlongStore } from './store.ts';

export const START_MS = 1_000_000;
export const FRAMES_PER_MS = 48;
export const LATENCY_MS = 180;
export const SESSION_ID = 'player';
export const OTHER_ID = 'other';

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

function fakeCommands(calls: string[]) {
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
    metronomePause: vi.fn(logged('metronomePause')),
    metronomeStop: vi.fn(logged('metronomeStop')),
    setBeats: vi.fn(logged('setBeats')),
    setAccent: vi.fn(logged('setAccent')),
    setSubdivision: vi.fn(logged('setSubdivision')),
    setSounds: vi.fn(logged('setSounds')),
    setVolume: vi.fn(logged('setVolume')),
    setLatencyOffset: vi.fn(logged('setLatencyOffset')),
  } satisfies PlayAlongRuntime['commands'];
}

export function fakePlayAlong({
  sessions = [snapshot()],
  onClickStarting = () => () => undefined,
}: {
  readonly sessions?: readonly MediaSessionSnapshot[];
  readonly onClickStarting?: PlayAlongRuntime['onClickStarting'];
} = {}) {
  vi.useFakeTimers({ now: START_MS });
  const calls: string[] = [];
  const commands = fakeCommands(calls);
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
  const runtime: PlayAlongRuntime = {
    commands,
    boottimeNowMs: () => Date.now(),
    engineFrameAtBoottimeMs: frameAt,
    sessions: () => media,
    sessionCommand,
    latencyOffsetMs: () => LATENCY_MS,
    onClickStarting,
  };
  return {
    store: createPlayAlongStore(runtime),
    calls,
    commands,
    media,
    pick,
    sessionCommand,
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
  };
}
