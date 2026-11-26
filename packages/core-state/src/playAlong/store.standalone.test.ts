import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMetronomeStore } from '../metronome/store.ts';
import {
  fakePlayAlong,
  locked,
  metronomeCommands,
  STANDALONE,
} from './store.test-helper.ts';

const STANDALONE_BPM = 150;
const ENGINE_BPM = 90;
const THREE = 3;
const QUARTER = 4;
const SOUND = 2;
const LATENCY_MS = 40;

afterEach(() => {
  vi.useRealTimers();
});

function followingWithMetronome() {
  const commands = metronomeCommands();
  const metronome = createMetronomeStore(
    commands,
    () => 0,
    () => ENGINE_BPM,
  );
  metronome.getState().start();
  const fake = locked(
    fakePlayAlong({
      yieldStandalone: () => metronome.getState().yieldEngine(),
    }),
  );
  for (const command of Object.values(commands)) command.mockClear();
  return { commands, metronome, fake };
}

const switchedBack = (fake: ReturnType<typeof locked>) =>
  fake.commands.metronomeSelectSlot.mock.invocationCallOrder.at(-1) ??
  Number.NaN;

describe('the standalone metronome while Play along follows', () => {
  it('sends nothing to the play-along slot and settles every edit after the switch back', () => {
    const { commands, metronome, fake } = followingWithMetronome();
    const standalone = metronome.getState();
    standalone.setTempo(STANDALONE_BPM);
    standalone.setBeats(THREE, QUARTER);
    standalone.setSounds(SOUND, SOUND);
    standalone.setLatency(LATENCY_MS);
    standalone.stop();
    for (const command of Object.values(commands))
      expect(command).not.toHaveBeenCalled();
    fake.store.getState().unlock();
    expect(fake.commands.metronomeSelectSlot).toHaveBeenLastCalledWith(
      STANDALONE,
    );
    const settled = [
      commands.setTempo,
      commands.setBeats,
      commands.setSounds,
      commands.setLatencyOffset,
      commands.metronomeStop,
    ];
    for (const command of settled) {
      expect(command).toHaveBeenCalledOnce();
      expect(command.mock.invocationCallOrder[0]).toBeGreaterThan(
        switchedBack(fake),
      );
    }
    expect(commands.setTempo).toHaveBeenCalledWith(STANDALONE_BPM);
    expect(commands.setLatencyOffset).toHaveBeenCalledWith(LATENCY_MS);
  });

  it('settles nothing when nothing was edited', () => {
    const { commands, fake } = followingWithMetronome();
    fake.store.getState().unlock();
    for (const command of Object.values(commands))
      expect(command).not.toHaveBeenCalled();
  });

  it('reads its own tempo instead of the play-along slot', () => {
    const { metronome } = followingWithMetronome();
    expect(metronome.getState().readTempo()).toBe(metronome.getState().bpm);
    expect(metronome.getState().readTempo()).not.toBe(ENGINE_BPM);
  });
});
