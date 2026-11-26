import { KB_METRONOME_SLOT, KB_RESULT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMetronomeStore } from '../metronome/store.ts';
import { songStarting } from '../stemPlayer/songStarting.ts';
import { clickStartsOf } from './runtime.ts';
import {
  call,
  fakePlayAlong,
  LATENCY_MS,
  START_MS,
} from './store.test-helper.ts';

const BPM = 120;
const PLAY_ALONG = KB_METRONOME_SLOT.KB_METRONOME_SLOT_PLAY_ALONG;
const STANDALONE = KB_METRONOME_SLOT.KB_METRONOME_SLOT_STANDALONE;
const SEVEN = 7;
const EIGHTH = 8;
const SUBDIVISION = 3;
const SOUND = 2;
const VOLUME = 0.5;

afterEach(() => {
  vi.useRealTimers();
});

function locked(fake = fakePlayAlong()) {
  fake.store.getState().setBpm(BPM);
  fake.store.getState().tap(START_MS);
  return fake;
}

function metronomeCommands() {
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

describe('Play along holding its own metronome slot', () => {
  it('holds the engine, selects its slot, then applies its pattern and calibration', () => {
    const { calls } = locked();
    expect(calls.slice(0, 2)).toEqual([
      'engineHold()',
      call('metronomeSelectSlot', PLAY_ALONG),
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        'setBeats(4,4)',
        'setSubdivision(1)',
        call('setLatencyOffset', LATENCY_MS),
      ]),
    );
    expect(
      calls.findIndex((c) => c.startsWith('metronomeAnchorExternal')),
    ).toBe(calls.length - 1);
  });

  it('applies the pattern set before following to its own slot only', () => {
    const fake = fakePlayAlong();
    fake.store.getState().setBeats(SEVEN, EIGHTH);
    fake.store.getState().setSubdivision(SUBDIVISION);
    fake.store.getState().setVolume(VOLUME);
    expect(fake.calls).toEqual([]);
    locked(fake);
    const selected = fake.calls.indexOf(
      call('metronomeSelectSlot', PLAY_ALONG),
    );
    expect(fake.calls.indexOf(call('setBeats', SEVEN, EIGHTH))).toBeGreaterThan(
      selected,
    );
    expect(fake.calls).toContain(call('setSubdivision', SUBDIVISION));
    expect(fake.calls).toContain(call('setVolume', VOLUME));
  });

  it('sends a pattern change straight to its slot while following', () => {
    const fake = locked();
    fake.calls.length = 0;
    fake.store.getState().setSounds(SOUND, SOUND);
    expect(fake.calls).toEqual([call('setSounds', SOUND, SOUND)]);
  });

  it('re-anchors when the meter changes while locked', () => {
    const fake = locked();
    const before = fake.anchors().length;
    fake.store.getState().setBeats(SEVEN, EIGHTH);
    expect(fake.anchors()).toHaveLength(before + 1);
  });

  it('ending the follow stops its slot, selects standalone, then releases the hold', () => {
    const fake = locked();
    fake.calls.length = 0;
    fake.store.getState().unlock();
    expect(fake.calls).toEqual([
      'metronomeStop()',
      call('metronomeSelectSlot', STANDALONE),
      'engineRelease()',
    ]);
    expect(fake.store.getState().lock).toBeUndefined();
  });

  it('ending twice touches the engine once', () => {
    const fake = locked();
    fake.store.getState().unlock();
    fake.store.getState().unlock();
    expect(fake.commands.engineRelease).toHaveBeenCalledOnce();
  });
});

describe('another Kitbag click ends the follow', () => {
  it('pressing Play on the standalone metronome unlocks before it starts', () => {
    const commands = metronomeCommands();
    const metronome = createMetronomeStore(commands, () => 0);
    const before = metronome.getState();
    const fake = locked(
      fakePlayAlong({ onClickStarting: clickStartsOf(metronome) }),
    );
    let selectedFirst = false;
    commands.metronomeStart.mockImplementation(() => {
      selectedFirst = fake.calls.includes(
        call('metronomeSelectSlot', STANDALONE),
      );
    });
    metronome.getState().start();
    expect(fake.store.getState().lock).toBeUndefined();
    expect(selectedFirst).toBe(true);
    expect(metronome.getState().bpm).toBe(before.bpm);
    expect(metronome.getState().beatsPerBar).toBe(before.beatsPerBar);
  });

  it('starting a Kitbag song unlocks', () => {
    const metronome = createMetronomeStore(metronomeCommands(), () => 0);
    const fake = locked(
      fakePlayAlong({ onClickStarting: clickStartsOf(metronome) }),
    );
    songStarting();
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.calls).toContain(call('metronomeSelectSlot', STANDALONE));
  });

  it('stops listening once the follow has ended', () => {
    const metronome = createMetronomeStore(metronomeCommands(), () => 0);
    const fake = locked(
      fakePlayAlong({ onClickStarting: clickStartsOf(metronome) }),
    );
    fake.store.getState().unlock();
    fake.calls.length = 0;
    songStarting();
    metronome.getState().start();
    expect(fake.calls).toEqual([]);
  });
});
