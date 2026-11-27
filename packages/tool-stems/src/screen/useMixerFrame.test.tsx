// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FRAME_MS, runFrame } from '../testing/reanimatedDriver.ts';
import { useMixerFrame, type MixerFrameValues } from './useMixerFrame.ts';

const starting = vi.hoisted(() => new Set<() => void>());

vi.mock('@kitbag/core-state', async (actual) => ({
  ...(await actual<Record<string, unknown>>()),
  onSongStarting: (listener: () => void) => {
    starting.add(listener);
    return () => {
      starting.delete(listener);
    };
  },
}));

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const RATE = 48000;
const DURATION = RATE * 10;
const HEAD = RATE * 2;
const COUNT_END = RATE * 3;
const SEEKED = RATE * 6;
const SECOND_MS = 1000;
const POLL_FRAMES = 10;

const reads = { count: 0 };

let renderer: ReactTestRenderer | undefined;

interface FrameSink {
  values?: MixerFrameValues;
}

interface ProbeProps {
  readonly countEnd: number | null;
  readonly held: number | null;
  readonly sink: FrameSink;
}

function Probe({ countEnd, held, sink }: ProbeProps) {
  sink.values = useMixerFrame(RATE, DURATION, null, {
    countEndFrame: countEnd,
    heldFrame: held,
  });
  return null;
}

function mount(
  countEnd: number | null = COUNT_END,
  held: number | null = null,
): MixerFrameValues {
  const sink: FrameSink = {};
  act(() => {
    renderer = create(<Probe countEnd={countEnd} held={held} sink={sink} />);
  });
  const { values } = sink;
  if (values === undefined) throw new Error('hook did not render');
  return values;
}

function setHost(
  playing: number,
  now: number,
  countingIn = 0,
  position = HEAD,
) {
  const fields = {
    mixer_position: position,
    mixer_playing: playing,
    frames_rendered: now,
    counting_in: countingIn,
  };
  const host = {};
  for (const [key, value] of Object.entries(fields))
    Object.defineProperty(host, key, {
      get: () => {
        reads.count++;
        return value;
      },
    });
  (globalThis as unknown as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] =
    host;
}

function runFrames(count: number) {
  for (let frame = 0; frame < count; frame++) runFrame();
}

function settle() {
  runFrames(Math.ceil(SECOND_MS / FRAME_MS));
}

function framesThatRead(count: number): number {
  let reading = 0;
  for (let frame = 0; frame < count; frame++) {
    const before = reads.count;
    runFrame();
    if (reads.count > before) reading++;
  }
  return reading;
}

function startInApp() {
  for (const listener of starting) listener();
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

describe('the playhead of a viewed song', () => {
  it('shows the held start and not the playing song', () => {
    const frame = mount(null, COUNT_END);
    setHost(1, 0);
    runFrame();
    expect(frame.progress.value).toBe(COUNT_END / DURATION);
    expect(frame.songSec.value).toBe(COUNT_END / RATE);
    expect(frame.playing.value).toBe(0);
  });

  it('shows the engine position once Play makes it live, even behind the held start', () => {
    const frame = mount(null, COUNT_END);
    act(() => {
      renderer?.update(<Probe countEnd={null} held={null} sink={{}} />);
    });
    setHost(1, 0);
    runFrame();
    expect(frame.songSec.value).toBe(HEAD / RATE);
  });
});

describe('the transport while the song counts in', () => {
  it('shows the song started until its count ends', () => {
    const frame = mount();
    setHost(0, 0);
    runFrame();
    expect(frame.playing.value).toBe(1);
    setHost(0, COUNT_END);
    runFrame();
    expect(frame.playing.value).toBe(0);
  });

  it("ignores the metronome tool's count-in", () => {
    const frame = mount(null);
    setHost(0, 0, 1);
    runFrame();
    expect(frame.playing.value).toBe(0);
  });

  it('holds the playhead on the bar the song will start from', () => {
    const frame = mount();
    setHost(0, 0);
    runFrame();
    runFrame();
    expect(frame.progress.value).toBe(HEAD / DURATION);
  });
});

describe('the playhead while the song is paused', () => {
  it('reads the engine on few frames, not every frame', () => {
    mount(null);
    setHost(0, 0);
    settle();
    const frames = Math.ceil(SECOND_MS / FRAME_MS);
    expect(framesThatRead(frames)).toBeLessThan(frames / 4);
  });

  it('moves on the first frame after a start in the app', () => {
    const frame = mount(null);
    setHost(0, 0);
    settle();
    setHost(1, 0, 0, SEEKED);
    startInApp();
    runFrame();
    expect(frame.playing.value).toBe(1);
    expect(frame.songSec.value).toBeGreaterThanOrEqual(SEEKED / RATE);
  });

  it('moves after a start from the notification, which the app is not told of', () => {
    const frame = mount(null);
    setHost(0, 0);
    settle();
    setHost(1, 0, 0, SEEKED);
    runFrames(POLL_FRAMES);
    expect(frame.playing.value).toBe(1);
  });

  it('jumps on the first frame after a scrub lets go', () => {
    const frame = mount(null);
    setHost(0, 0);
    settle();
    frame.hold(SEEKED / DURATION);
    runFrame();
    expect(frame.progress.value).toBe(SEEKED / DURATION);
    setHost(0, 0, 0, SEEKED);
    settle();
    expect(frame.progress.value).toBe(SEEKED / DURATION);
  });

  it('jumps to a seek from the notification', () => {
    const frame = mount(null);
    setHost(0, 0);
    settle();
    setHost(0, 0, 0, SEEKED);
    runFrames(POLL_FRAMES);
    expect(frame.songSec.value).toBe(SEEKED / RATE);
  });

  it('follows a count-in on every frame and moves when the song starts', () => {
    const frame = mount(null);
    setHost(0, 0, 1);
    settle();
    expect(framesThatRead(POLL_FRAMES)).toBe(POLL_FRAMES);
    setHost(1, 0, 0, SEEKED);
    runFrame();
    expect(frame.playing.value).toBe(1);
  });
});

describe('the playhead while the song plays', () => {
  it('stops at the end of the song on the next frame', () => {
    const frame = mount(null);
    setHost(1, 0);
    settle();
    setHost(0, 0, 0, DURATION);
    runFrame();
    expect(frame.playing.value).toBe(0);
    expect(frame.progress.value).toBe(1);
  });

  it('goes back to the loop start when the loop wraps', () => {
    const frame = mount(null);
    setHost(1, 0, 0, SEEKED);
    settle();
    setHost(1, 0, 0, HEAD);
    runFrame();
    expect(frame.songSec.value).toBeLessThan(SEEKED / RATE);
  });
});
