import { createToolsStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

import { TOOL_ID } from '../home/registry.ts';
import { stopWhenSwitchedOff, toolStoppers } from './toolStoppers.ts';

function fakeTools(
  running: boolean,
  stemSetId: number | null,
  songId: number | null = null,
) {
  const release = vi.fn();
  const close = vi.fn();
  const closeSong = vi.fn();
  const stoppers = toolStoppers({
    metronome: { active: () => running, release },
    stemPlayer: { getState: () => ({ setId: stemSetId, close }) },
    songPlayer: { getState: () => ({ songId, close: closeSong }) },
  });
  return { stoppers, release, close, closeSong };
}

describe('toolStoppers', () => {
  it('stops a playing metronome and drops its notification', () => {
    const { stoppers, release } = fakeTools(true, null);
    stoppers[TOOL_ID.metronome]?.();
    expect(release).toHaveBeenCalledOnce();
  });

  it('leaves an idle metronome alone', () => {
    const { stoppers, release } = fakeTools(false, null);
    stoppers[TOOL_ID.metronome]?.();
    expect(release).not.toHaveBeenCalled();
  });

  it('closes an open stem song, which stops it and hides its notification', () => {
    const { stoppers, close } = fakeTools(false, 7);
    stoppers[TOOL_ID.stems]?.();
    expect(close).toHaveBeenCalledOnce();
  });

  it('does nothing when no stem song is open', () => {
    const { stoppers, close } = fakeTools(false, null);
    stoppers[TOOL_ID.stems]?.();
    expect(close).not.toHaveBeenCalled();
  });

  it('closes an open song when the library goes off', () => {
    const { stoppers, closeSong } = fakeTools(false, null, 3);
    stoppers[TOOL_ID.library]?.();
    expect(closeSong).toHaveBeenCalledOnce();
  });

  it('does nothing when no song is open', () => {
    const { stoppers, closeSong } = fakeTools(false, null);
    stoppers[TOOL_ID.library]?.();
    expect(closeSong).not.toHaveBeenCalled();
  });
});

describe('stopWhenSwitchedOff', () => {
  it('stops only the tool that was just switched off', () => {
    const store = createToolsStore();
    const metronome = vi.fn();
    const stems = vi.fn();
    stopWhenSwitchedOff(store, {
      [TOOL_ID.metronome]: metronome,
      [TOOL_ID.stems]: stems,
    });
    store.getState().setOff([TOOL_ID.metronome]);
    store.getState().setOff([TOOL_ID.metronome, TOOL_ID.tuner]);
    expect(metronome).toHaveBeenCalledOnce();
    expect(stems).not.toHaveBeenCalled();
  });
});
