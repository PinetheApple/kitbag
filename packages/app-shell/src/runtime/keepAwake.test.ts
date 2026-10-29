import type { MicStatus, StemPlayerStatus } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { screenStaysOn, wireKeepAwake } from './keepAwake.ts';

function fakeSource<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next: T) => {
      state = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

function rig() {
  const metronome = fakeSource({ running: false });
  const tuner = fakeSource<{ mic: MicStatus }>({ mic: 'off' });
  const stemPlayer = fakeSource<{ status: StemPlayerStatus }>({
    status: 'idle',
  });
  const calls: boolean[] = [];
  const engine = { mixerPlaying: false };
  let tick: (() => void) | undefined;
  let polls = 0;
  let foreground: (() => void) | undefined;
  wireKeepAwake({
    metronome,
    tuner,
    stemPlayer,
    mixerPlaying: () => engine.mixerPlaying,
    poll: (onTick) => {
      polls++;
      tick = onTick;
      return () => {
        tick = undefined;
      };
    },
    onForeground: (listener) => {
      foreground = listener;
    },
    setKeepScreenOn: (on) => calls.push(on),
  });
  return {
    metronome,
    tuner,
    stemPlayer,
    calls,
    engine,
    tick: () => tick?.(),
    polling: () => tick !== undefined,
    polls: () => polls,
    foreground: () => foreground?.(),
  };
}

describe('screenStaysOn', () => {
  const idle = {
    metronomeRunning: false,
    songPlaying: false,
    tunerListening: false,
  };

  it('lets the screen sleep when nothing is running', () => {
    expect(screenStaysOn(idle)).toBe(false);
  });

  it.each(['metronomeRunning', 'songPlaying', 'tunerListening'] as const)(
    'keeps the screen on while %s',
    (flag) => {
      expect(screenStaysOn({ ...idle, [flag]: true })).toBe(true);
    },
  );
});

describe('wireKeepAwake', () => {
  it('holds the screen while the metronome runs and releases it on stop', () => {
    const r = rig();
    r.metronome.set({ running: true });
    r.metronome.set({ running: true });
    r.metronome.set({ running: false });
    expect(r.calls).toEqual([true, false]);
  });

  it('holds the screen only once the tuner is listening, not while it starts', () => {
    const r = rig();
    r.tuner.set({ mic: 'starting' });
    expect(r.calls).toEqual([]);
    r.tuner.set({ mic: 'listening' });
    r.tuner.set({ mic: 'off' });
    expect(r.calls).toEqual([true, false]);
  });

  it('follows the mixer while a song is open, through play, pause and close', () => {
    const r = rig();
    expect(r.polling()).toBe(false);
    r.stemPlayer.set({ status: 'ready' });
    expect(r.polling()).toBe(true);
    expect(r.calls).toEqual([]);

    r.engine.mixerPlaying = true;
    r.tick();
    r.tick();
    r.engine.mixerPlaying = false;
    r.tick();
    expect(r.calls).toEqual([true, false]);

    r.engine.mixerPlaying = true;
    r.tick();
    r.stemPlayer.set({ status: 'idle' });
    expect(r.polling()).toBe(false);
    expect(r.calls).toEqual([true, false, true, false]);
  });

  it('starts one poll per open song', () => {
    const r = rig();
    r.stemPlayer.set({ status: 'ready' });
    r.stemPlayer.set({ status: 'ready' });
    expect(r.polls()).toBe(1);
  });

  it('stays on while any source still runs', () => {
    const r = rig();
    r.metronome.set({ running: true });
    r.tuner.set({ mic: 'listening' });
    r.metronome.set({ running: false });
    expect(r.calls).toEqual([true]);
  });

  it('re-sends the hold on foreground only while it is held', () => {
    const r = rig();
    r.foreground();
    expect(r.calls).toEqual([]);
    r.metronome.set({ running: true });
    r.foreground();
    expect(r.calls).toEqual([true, true]);
  });
});
