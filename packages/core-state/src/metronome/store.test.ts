import {
  KB_ACCENT,
  KB_DEFAULT_COUNT_IN_SOUND,
  KB_MAX_BEATS,
  KB_MAX_MUTE_BARS,
  KB_POLY_BEATS_BOUNDS,
  KB_MAX_RAMP_BARS,
  KB_RAMP_SECONDS_BOUNDS,
  KB_RAMP_UNIT,
  KB_SOUND_NAMES,
  KB_VOLUME_BOUNDS,
} from '@kitbag/core-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type MetronomeCommands } from './commands.ts';
import { createMetronomeStore } from './store.ts';

function makeCommands() {
  return {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    metronomePause: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setPolyAccent: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
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
    store.getState().setRamp({
      enabled: true,
      startBpm: 100,
      endBpm: 140,
      duration: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    expect(store.getState().ramp.enabled).toBe(true);

    store.getState().setTempo(130);

    expect(store.getState().ramp.enabled).toBe(false);
    expect(commands.setTempo).toHaveBeenCalledWith(130);
  });
});

describe('§5.2 cycleAccent cycles accent → normal → mute → accent', () => {
  it('advances the tapped beat through all three states and back', () => {
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

describe('sounds use engine ids, per role', () => {
  it('sends both roles and ignores an invalid id per role', () => {
    const last = KB_SOUND_NAMES.length - 1;
    store.getState().setSounds(3, last);
    expect(store.getState().sounds).toEqual({ normal: 3, accent: last });
    expect(commands.setSounds).toHaveBeenLastCalledWith(3, last);

    store.getState().setSounds(KB_SOUND_NAMES.length, 1);
    expect(store.getState().sounds).toEqual({ normal: 3, accent: 1 });
    expect(commands.setSounds).toHaveBeenLastCalledWith(3, 1);

    store.getState().setSounds(-1, 1.5);
    expect(store.getState().sounds).toEqual({ normal: 3, accent: 1 });
    expect(commands.setSounds).toHaveBeenCalledTimes(2);
  });

  it('previews only valid ids', () => {
    store.getState().previewSound(2, true);
    store.getState().previewSound(KB_SOUND_NAMES.length, false);
    expect(commands.previewSound).toHaveBeenCalledTimes(1);
    expect(commands.previewSound).toHaveBeenCalledWith(2, true);
  });
});

describe('poly row accents', () => {
  it('cycles poly accents independently of the main row', () => {
    store.getState().cyclePolyAccent(1);
    expect(store.getState().polyAccents[1]).toBe(KB_ACCENT.KB_ACCENT_MUTED);
    expect(store.getState().accents[1]).toBe(KB_ACCENT.KB_ACCENT_NORMAL);
    expect(commands.setPolyAccent).toHaveBeenCalledWith(
      1,
      KB_ACCENT.KB_ACCENT_MUTED,
    );
    expect(commands.setAccent).not.toHaveBeenCalled();
  });

  it('keeps kept slots and resets regrown ones to normal, like the engine', () => {
    store.getState().setPoly(true, 5);
    store.getState().cyclePolyAccent(1);
    store.getState().cyclePolyAccent(4);
    store.getState().setPoly(true, 3);
    store.getState().setPoly(true, 5);
    expect(store.getState().polyAccents).toEqual([
      KB_ACCENT.KB_ACCENT_ACCENTED,
      KB_ACCENT.KB_ACCENT_MUTED,
      KB_ACCENT.KB_ACCENT_NORMAL,
      KB_ACCENT.KB_ACCENT_NORMAL,
      KB_ACCENT.KB_ACCENT_NORMAL,
    ]);
  });

  it('ignores accent edits past the bar or the poly count', () => {
    store.getState().cycleAccent(store.getState().beatsPerBar);
    store.getState().cyclePolyAccent(store.getState().polyBeats);
    expect(commands.setAccent).not.toHaveBeenCalled();
    expect(commands.setPolyAccent).not.toHaveBeenCalled();
  });
});

describe('tempo ramp matches what the engine holds', () => {
  const ramp = {
    enabled: true,
    startBpm: 90,
    endBpm: 120,
    duration: 4,
    unit: KB_RAMP_UNIT.KB_RAMP_BARS,
    loop: true,
  } as const;

  it('dispatches unit and loop', () => {
    store.getState().setRamp(ramp);
    expect(commands.setRamp).toHaveBeenCalledWith(
      true,
      90,
      120,
      4,
      KB_RAMP_UNIT.KB_RAMP_BARS,
      true,
    );
  });

  it('clamps durations per unit to the generated bounds', () => {
    store.getState().setRamp({ ...ramp, duration: 999.4 });
    expect(store.getState().ramp.duration).toBe(KB_MAX_RAMP_BARS);
    store
      .getState()
      .setRamp({ ...ramp, duration: 0.2, unit: KB_RAMP_UNIT.KB_RAMP_SECONDS });
    expect(store.getState().ramp.duration).toBe(KB_RAMP_SECONDS_BOUNDS.min);
    store
      .getState()
      .setRamp({ ...ramp, duration: 90, unit: KB_RAMP_UNIT.KB_RAMP_MINUTES });
    expect(store.getState().ramp.duration).toBe(
      KB_RAMP_SECONDS_BOUNDS.max / 60,
    );
  });

  it('keeps the previous ramp on non-finite input or an unknown unit', () => {
    store.getState().setRamp(ramp);
    store.getState().setRamp({ ...ramp, startBpm: Infinity });
    store.getState().setRamp({ ...ramp, unit: 7 as unknown as KB_RAMP_UNIT });
    expect(store.getState().ramp).toEqual(ramp);
    expect(commands.setRamp).toHaveBeenCalledTimes(1);
  });
});

describe('engine bounds on volume and bar mute', () => {
  it('clamps volume to the generated range before state and command', () => {
    store.getState().setVolume(5);
    expect(store.getState().volume).toBe(KB_VOLUME_BOUNDS.max);
    expect(commands.setVolume).toHaveBeenLastCalledWith(KB_VOLUME_BOUNDS.max);
    store.getState().setVolume(-1);
    expect(store.getState().volume).toBe(KB_VOLUME_BOUNDS.min);
    expect(commands.setVolume).toHaveBeenLastCalledWith(KB_VOLUME_BOUNDS.min);
  });

  it('clamps play and mute bars to 1..KB_MAX_MUTE_BARS', () => {
    store.getState().setBarMute({ enabled: true, playBars: 0, muteBars: 99 });
    expect(store.getState().barMute).toEqual({
      enabled: true,
      playBars: 1,
      muteBars: KB_MAX_MUTE_BARS,
    });
    expect(commands.setBarMute).toHaveBeenLastCalledWith(
      true,
      1,
      KB_MAX_MUTE_BARS,
    );
  });
});

describe('count-in', () => {
  it('starts off with the engine default distinct sound', () => {
    expect(store.getState().countIn).toEqual({
      bars: 0,
      distinct: true,
      sound: KB_DEFAULT_COUNT_IN_SOUND,
    });
  });

  it('dispatches valid values and keeps the previous bars or sound otherwise', () => {
    store.getState().setCountIn({ bars: 2, distinct: false, sound: 3 });
    expect(commands.setCountIn).toHaveBeenLastCalledWith(2, false, 3);

    store.getState().setCountIn({
      bars: 3 as unknown as 2,
      distinct: true,
      sound: KB_SOUND_NAMES.length,
    });
    expect(store.getState().countIn).toEqual({
      bars: 2,
      distinct: true,
      sound: 3,
    });
    expect(commands.setCountIn).toHaveBeenLastCalledWith(2, true, 3);
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

  it('setPoly / setVolume / setLatency / setBarMute dispatch', () => {
    store.getState().setPoly(true, 3);
    expect(commands.setPoly).toHaveBeenCalledWith(true, 3);

    store.getState().setVolume(1.5);
    expect(commands.setVolume).toHaveBeenCalledWith(1.5);

    store.getState().setLatency(250); // clamped to the generated +100 bound
    expect(store.getState().latencyOffset).toBe(100);
    expect(commands.setLatencyOffset).toHaveBeenCalledWith(100);

    store.getState().setBarMute({ enabled: true, playBars: 3, muteBars: 1 });
    expect(commands.setBarMute).toHaveBeenCalledWith(true, 3, 1);
  });

  it('setPoly bounds the poly count instead of dispatching nonsense', () => {
    store.getState().setPoly(true, 3);
    commands.setPoly.mockClear();

    store.getState().setPoly(true, KB_POLY_BEATS_BOUNDS.min - 1);
    expect(store.getState().polyBeats).toBe(3);
    expect(commands.setPoly).not.toHaveBeenCalled();

    store.getState().setPoly(true, 999);
    expect(store.getState().polyBeats).toBe(KB_POLY_BEATS_BOUNDS.max);
    expect(commands.setPoly).toHaveBeenLastCalledWith(
      true,
      KB_POLY_BEATS_BOUNDS.max,
    );
  });
});

describe('transport start / stop / pause', () => {
  it('start opens the device and starts the transport at the polled frame', () => {
    store.getState().start();
    expect(commands.start).toHaveBeenCalledTimes(1);
    expect(commands.metronomeStart).toHaveBeenCalledWith(NOW_FRAME);
    expect(store.getState().running).toBe(true);
  });

  it('stop and pause send distinct engine commands (§5.3)', () => {
    store.getState().start();
    store.getState().stop();
    expect(store.getState().running).toBe(false);
    expect(commands.metronomeStop).toHaveBeenCalledTimes(1);

    store.getState().start();
    store.getState().pause();
    expect(store.getState().running).toBe(false);
    expect(commands.metronomePause).toHaveBeenCalledTimes(1);
    expect(commands.metronomeStop).toHaveBeenCalledTimes(1);
  });

  it('holds no count-in timing shadow', () => {
    expect(Object.keys(store.getState())).not.toContain('countInArmed');
  });
});

describe('§5.3 tempo shown and nudged is the engine tempo, not a stale intent', () => {
  function makeEngine() {
    const engine = { bpm: 120, rampEnd: 120 };
    const cmds = makeCommands();
    cmds.setTempo.mockImplementation((bpm: number) => {
      engine.bpm = bpm;
    });
    cmds.setRamp.mockImplementation(
      (enabled: boolean, startBpm: number, endBpm: number) => {
        if (!enabled) return;
        engine.bpm = startBpm;
        engine.rampEnd = endBpm;
      },
    );
    const s = createMetronomeStore(
      cmds,
      () => NOW_FRAME,
      () => engine.bpm,
    );
    return { engine, cmds, s };
  }

  it('nudges from the ramped engine tempo and clears the ramp chip', () => {
    const { engine, cmds, s } = makeEngine();
    s.getState().start();
    s.getState().setRamp({
      enabled: true,
      startBpm: 100,
      endBpm: 140,
      duration: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    engine.bpm = 130.4;
    s.getState().nudgeTempo(5);
    expect(cmds.setTempo).toHaveBeenLastCalledWith(135);
    expect(s.getState().ramp.enabled).toBe(false);
    expect(s.getState().bpm).toBe(engine.bpm);
  });

  it('adopts the engine tempo when a running ramp is cleared', () => {
    const { engine, s } = makeEngine();
    s.getState().start();
    s.getState().setRamp({
      enabled: true,
      startBpm: 100,
      endBpm: 140,
      duration: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    engine.bpm = 118;
    s.getState().setRamp({ ...s.getState().ramp, enabled: false });
    expect(s.getState().bpm).toBe(118);
  });

  it('adopts the engine tempo on stop, after a ramp has finished', () => {
    const { engine, s } = makeEngine();
    s.getState().start();
    s.getState().setRamp({
      enabled: true,
      startBpm: 100,
      endBpm: 140,
      duration: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    engine.bpm = engine.rampEnd;
    s.getState().stop();
    expect(s.getState().bpm).toBe(140);
  });

  it('adopts the engine tempo on pause', () => {
    const { engine, s } = makeEngine();
    s.getState().start();
    s.getState().setRamp({
      enabled: true,
      startBpm: 100,
      endBpm: 140,
      duration: 8,
      unit: KB_RAMP_UNIT.KB_RAMP_BARS,
      loop: false,
    });
    engine.bpm = 126;
    s.getState().pause();
    expect(s.getState().bpm).toBe(126);
  });

  it('trusts its own tempo before start, while commands still queue', () => {
    const engine = { bpm: 120 };
    const s = createMetronomeStore(
      makeCommands(),
      () => NOW_FRAME,
      () => engine.bpm,
    );
    s.getState().setTempo(97);
    s.getState().nudgeTempo(5);
    expect(s.getState().bpm).toBe(102);
    s.getState().syncTempoFromEngine();
    expect(s.getState().bpm).toBe(102);
  });

  it('keeps its own tempo when no HostObject is installed', () => {
    const cmds = makeCommands();
    const s = createMetronomeStore(
      cmds,
      () => NOW_FRAME,
      () => {
        throw new Error('not installed');
      },
    );
    s.getState().start();
    s.getState().setTempo(97);
    s.getState().nudgeTempo(5);
    expect(s.getState().bpm).toBe(102);
  });
});
