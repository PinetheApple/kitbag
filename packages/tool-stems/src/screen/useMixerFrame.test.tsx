// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';

import { runFrame } from '../testing/reanimatedDriver.ts';
import { useMixerFrame, type MixerFrameValues } from './useMixerFrame.ts';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const RATE = 48000;
const DURATION = RATE * 10;
const HEAD = RATE * 2;
const COUNT_END = RATE * 3;

let renderer: ReactTestRenderer | undefined;

interface FrameSink {
  values?: MixerFrameValues;
}

interface ProbeProps {
  readonly countEnd: number | null;
  readonly sink: FrameSink;
}

function Probe({ countEnd, sink }: ProbeProps) {
  sink.values = useMixerFrame(RATE, DURATION, null, countEnd);
  return null;
}

function mount(countEnd: number | null = COUNT_END): MixerFrameValues {
  const sink: FrameSink = {};
  act(() => {
    renderer = create(<Probe countEnd={countEnd} sink={sink} />);
  });
  const { values } = sink;
  if (values === undefined) throw new Error('hook did not render');
  return values;
}

function setHost(playing: number, now: number, countingIn = 0) {
  (globalThis as unknown as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] = {
    mixer_position: HEAD,
    mixer_playing: playing,
    frames_rendered: now,
    counting_in: countingIn,
  };
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
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
