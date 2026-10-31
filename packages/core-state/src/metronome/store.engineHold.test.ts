import { KB_RESULT } from '@kitbag/core-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type MetronomeCommands } from './commands.ts';
import { createMetronomeStore } from './store.ts';

const SOUND = 2;
const CYCLES = 12;
const FAILED_HOLDS = 3;
const UNREACHED_HOLDS = 1;

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
  } satisfies MetronomeCommands;
}

let commands: ReturnType<typeof makeCommands>;
let store: ReturnType<typeof createMetronomeStore>;

beforeEach(() => {
  commands = makeCommands();
  store = createMetronomeStore(commands, () => 0);
});

describe('the metronome screen holding the output device', () => {
  it('releases once when the screen leaves while stopped', () => {
    const release = store.getState().holdEngine();
    release();
    release();
    expect(commands.engineHold).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('keeps the hold through stop, pause and a notification stop', () => {
    store.getState().holdEngine();
    store.getState().start();
    store.getState().stop();
    store.getState().start();
    store.getState().pause();
    store.setState({ running: true });
    store.setState({ running: false });
    expect(commands.engineRelease).not.toHaveBeenCalled();
  });

  it('releases every hold that reached the engine, failed or not', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    commands.engineHold
      .mockResolvedValueOnce(KB_RESULT.KB_ERROR_DEVICE_START_FAILED)
      .mockRejectedValueOnce(new Error('no module'))
      .mockImplementationOnce(() => {
        throw new Error('no module');
      });
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      const release = store.getState().holdEngine();
      release();
    }
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(FAILED_HOLDS);
    });
    expect(commands.engineHold).toHaveBeenCalledTimes(CYCLES);
    expect(commands.engineRelease).toHaveBeenCalledTimes(
      CYCLES - UNREACHED_HOLDS,
    );
    warn.mockRestore();
  });
});

describe('previewing a sound', () => {
  it('reaches the engine only while a hold is open', () => {
    store.getState().previewSound(SOUND, false);
    const release = store.getState().holdEngine();
    store.getState().previewSound(SOUND, true);
    release();
    store.getState().previewSound(SOUND, false);
    expect(commands.previewSound).toHaveBeenCalledOnce();
    expect(commands.previewSound).toHaveBeenCalledWith(SOUND, true);
    const [held] = commands.engineHold.mock.invocationCallOrder;
    const [previewed] = commands.previewSound.mock.invocationCallOrder;
    const [released] = commands.engineRelease.mock.invocationCallOrder;
    expect(held).toBeLessThan(previewed ?? 0);
    expect(previewed).toBeLessThan(released ?? 0);
  });

  it('stays live while a second holder outlasts the first', () => {
    const screen = store.getState().holdEngine();
    const sheet = store.getState().holdEngine();
    sheet();
    store.getState().previewSound(SOUND, false);
    screen();
    expect(commands.previewSound).toHaveBeenCalledOnce();
  });
});
