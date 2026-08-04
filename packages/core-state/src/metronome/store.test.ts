// TDD + sabotage acceptance for the metronome config store (SPEC §5.1–§5.3,
// §13.3, §13.7). Every load-bearing invariant has a test that fails if the
// behaviour is removed — a green run means the store maps intent to the engine
// commands and keeps realtime truth OUT, not that an assertion is asleep.

import { KB_ACCENT, KB_MAX_BEATS, KB_SOUND_NAMES } from '@kitbag/core-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type MetronomeCommands } from './commands.ts';
import { createMetronomeStore } from './store.ts';

function makeCommands() {
  return {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setSound: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
  } satisfies MetronomeCommands;
}

const NOW_FRAME = 48_000;
let commands: ReturnType<typeof makeCommands>;
let store: ReturnType<typeof createMetronomeStore>;

beforeEach(() => {
  commands = makeCommands();
  store = createMetronomeStore(commands, () => NOW_FRAME);
});

describe('§13.3 no realtime values in the store', () => {
  it('holds no field that shadows an engine poll', () => {
    const forbidden = [
      'current_beat',
      'currentBeat',
      'bar_phase',
      'barPhase',
      'current_bpm',
      'currentBpm',
      'frames_rendered',
      'framesRendered',
      'tuner_snapshot',
      'tunerSnapshot',
      'player_position',
      'playerPosition',
    ];
    const keys = Object.keys(store.getState());
    for (const name of forbidden) {
      expect(keys).not.toContain(name);
    }
  });
});

describe('§5.3 manual tempo cancels a running ramp', () => {
  it('clears ramp.enabled on setTempo', () => {
    store
      .getState()
      .setRamp({ enabled: true, startBpm: 100, endBpm: 140, bars: 8 });
    expect(store.getState().ramp.enabled).toBe(true);

    store.getState().setTempo(130);

    expect(store.getState().ramp.enabled).toBe(false);
    expect(commands.setTempo).toHaveBeenCalledWith(130);
  });
});

describe('§5.2 cycleAccent cycles accent → normal → mute → accent', () => {
  it('advances the tapped beat through all three states and back', () => {
    // Beat 0 starts accented (downbeat default).
    expect(store.getState().accents[0]).toBe(KB_ACCENT.KB_ACCENT_ACCENTED);

    store.getState().cycleAccent(0);
    expect(store.getState().accents[0]).toBe(KB_ACCENT.KB_ACCENT_NORMAL);
    expect(commands.setAccent).toHaveBeenLastCalledWith(
      0,
      KB_ACCENT.KB_ACCENT_NORMAL,
    );

    store.getState().cycleAccent(0);
    expect(store.getState().accents[0]).toBe(KB_ACCENT.KB_ACCENT_MUTED);

    store.getState().cycleAccent(0);
    expect(store.getState().accents[0]).toBe(KB_ACCENT.KB_ACCENT_ACCENTED);
  });

  it('leaves other beats untouched', () => {
    store.getState().cycleAccent(1);
    expect(store.getState().accents[0]).toBe(KB_ACCENT.KB_ACCENT_ACCENTED);
    expect(store.getState().accents[1]).toBe(KB_ACCENT.KB_ACCENT_MUTED);
  });
});

describe('clamps (clamp, not reject)', () => {
  it('clamps BPM to 20–400 and sends the clamped value', () => {
    store.getState().setTempo(5);
    expect(store.getState().bpm).toBe(20);
    expect(commands.setTempo).toHaveBeenLastCalledWith(20);

    store.getState().setTempo(999);
    expect(store.getState().bpm).toBe(400);
    expect(commands.setTempo).toHaveBeenLastCalledWith(400);
  });

  it('clamps subdivision to 1–16', () => {
    store.getState().setSubdivision(99);
    expect(store.getState().subdivision).toBe(16);
    store.getState().setSubdivision(0);
    expect(store.getState().subdivision).toBe(1);
  });

  it('accepts only engine-listed denominators, keeping the current one otherwise', () => {
    store.getState().setBeats(7, 8);
    expect(store.getState().denominator).toBe(8);

    store.getState().setBeats(7, 3);
    expect(store.getState().denominator).toBe(8);
    expect(store.getState().beatsPerBar).toBe(7);
  });

  it('clamps beatsPerBar to the engine ceiling', () => {
    store.getState().setBeats(99, 4);
    expect(store.getState().beatsPerBar).toBe(KB_MAX_BEATS);
    expect(store.getState().accents).toHaveLength(KB_MAX_BEATS);
    expect(commands.setBeats).toHaveBeenLastCalledWith(KB_MAX_BEATS, 4);
  });
});

describe('§13.7 sound names come from the engine constants', () => {
  it('accepts every generated sound index and rejects out-of-range', () => {
    const last = KB_SOUND_NAMES.length - 1;
    store.getState().setSound(last);
    expect(store.getState().sound).toBe(last);
    expect(commands.setSound).toHaveBeenLastCalledWith(last);

    store.getState().setSound(KB_SOUND_NAMES.length); // one past the table
    expect(store.getState().sound).toBe(last); // unchanged
    expect(commands.setSound).toHaveBeenCalledTimes(1);
  });
});

describe('every mutation maps 1:1 onto an engine command', () => {
  it('setBeats sends both halves of the time signature', () => {
    store.getState().setBeats(5, 4);
    expect(commands.setBeats).toHaveBeenCalledWith(5, 4);
  });

  it('setBeats sends the retained denominator when given an invalid one', () => {
    store.getState().setBeats(7, 8);
    store.getState().setBeats(3, 5);
    expect(commands.setBeats).toHaveBeenLastCalledWith(3, 8);
  });

  it('setPoly / setVolume / setLatency / setRamp / setBarMute dispatch', () => {
    store.getState().setPoly(true, 3);
    expect(commands.setPoly).toHaveBeenCalledWith(true, 3);

    store.getState().setVolume(1.5);
    expect(commands.setVolume).toHaveBeenCalledWith(1.5);

    store.getState().setLatency(250); // clamped to the generated +100 bound
    expect(store.getState().latencyOffset).toBe(100);
    expect(commands.setLatencyOffset).toHaveBeenCalledWith(100);

    store
      .getState()
      .setRamp({ enabled: true, startBpm: 90, endBpm: 120, bars: 4 });
    expect(commands.setRamp).toHaveBeenCalledWith(true, 90, 120, 4);

    store.getState().setBarMute({ enabled: true, playBars: 3, muteBars: 1 });
    expect(commands.setBarMute).toHaveBeenCalledWith(true, 3, 1);
  });

  it('setCountIn stays human-speed only (no engine command exists)', () => {
    store.getState().setCountIn(2);
    expect(store.getState().countInBars).toBe(2);
  });

  it('setPerAccentSounds is store-only: records intent, issues no command', () => {
    store.getState().setPerAccentSounds({ normal: 0, accent: 1 });
    expect(store.getState().perAccentSounds).toEqual({ normal: 0, accent: 1 });
    expect(commands.setSound).not.toHaveBeenCalled();
  });
});

describe('transport start / stop / pause', () => {
  it('start opens the device and starts the transport at the polled frame', () => {
    store.getState().start();
    expect(commands.start).toHaveBeenCalledTimes(1);
    expect(commands.metronomeStart).toHaveBeenCalledWith(NOW_FRAME);
    expect(store.getState().running).toBe(true);
  });

  it('stop re-arms count-in; pause does not (§5.3)', () => {
    store.getState().start();
    store.getState().stop();
    expect(store.getState().running).toBe(false);
    expect(store.getState().countInArmed).toBe(true);
    expect(commands.metronomeStop).toHaveBeenCalledTimes(1);

    store.getState().start();
    store.getState().pause();
    expect(store.getState().running).toBe(false);
    expect(store.getState().countInArmed).toBe(false);
    expect(commands.metronomeStop).toHaveBeenCalledTimes(2);
  });
});
