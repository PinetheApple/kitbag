import { KB_COUNT_IN_OFF, KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  COUNT_IN_DRAIN_MARGIN_SECONDS,
  countedStart,
  type CountedStartRequest,
} from './countedStart.ts';

const RATE = 48000;
const NOW = 1_000_000;
const at = (seconds: number) => Math.round(seconds * RATE);
const LEAD = at(COUNT_IN_DRAIN_MARGIN_SECONDS);

const FOUR_FOUR = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];

function request(change: Partial<CountedStartRequest>): CountedStartRequest {
  return {
    headFrame: at(2.3),
    nowFrame: NOW,
    engineRate: RATE,
    playbackRate: 1,
    bars: 1,
    beats: FOUR_FOUR,
    downbeatIndices: [0, 4, 8],
    ...change,
  };
}

describe('a counted start', () => {
  it('starts the song on the bar at or before the head', () => {
    expect(countedStart(request({}))?.startFrame).toBe(at(2));
    expect(countedStart(request({ headFrame: at(4) }))?.startFrame).toBe(at(4));
    expect(countedStart(request({ headFrame: at(1.99) }))?.startFrame).toBe(
      at(0),
    );
  });

  it('starts on the first bar from a head before it', () => {
    const plan = countedStart(
      request({ headFrame: 0, beats: [0.3, ...FOUR_FOUR.map((b) => b + 0.8)] }),
    );
    expect(plan?.startFrame).toBe(at(0.3));
  });

  it("counts the bar the song starts in, in that bar's beats", () => {
    const threeFour = { downbeatIndices: [0, 3, 6, 9] };
    expect(countedStart(request(threeFour))?.beatsPerBar).toBe(3);
    expect(
      countedStart(request({ ...threeFour, headFrame: at(5) }))?.beatsPerBar,
    ).toBe(3);
    expect(
      countedStart(request({ downbeatIndices: [0, 4, 6], headFrame: at(2) }))
        ?.beatsPerBar,
    ).toBe(2);
  });

  it('counts at the grid interval before the start, slowed by the speed', () => {
    const beats = [0, 0.5, 1, 1.6, 2.2, 2.7];
    const downbeats = { beats, downbeatIndices: [0, 4] };
    expect(countedStart(request(downbeats))?.beatFrames).toBeCloseTo(
      0.6 * RATE,
    );
    expect(
      countedStart(request({ ...downbeats, playbackRate: 0.75 }))?.beatFrames,
    ).toBeCloseTo((0.6 * RATE) / 0.75);
    expect(
      countedStart(request({ ...downbeats, headFrame: 0 }))?.beatFrames,
    ).toBeCloseTo(0.5 * RATE);
  });

  it('ends the count after every count beat, with room to reach the engine', () => {
    const plan = countedStart(request({ bars: 2, playbackRate: 0.5 }));
    expect(plan?.endFrame).toBe(NOW + LEAD + 2 * 4 * at(1));
    expect(Number.isInteger(plan?.endFrame)).toBe(true);
  });

  it('has no counted start without a count-in, bars, a tempo or a speed', () => {
    expect(countedStart(request({ bars: KB_COUNT_IN_OFF }))).toBeNull();
    expect(countedStart(request({ bars: 3 }))).toBeNull();
    expect(countedStart(request({ downbeatIndices: [] }))).toBeNull();
    expect(countedStart(request({ downbeatIndices: [4] }))).toBeNull();
    expect(
      countedStart(request({ beats: [0], downbeatIndices: [0] })),
    ).toBeNull();
    expect(countedStart(request({ playbackRate: 0 }))).toBeNull();
    expect(countedStart(request({ engineRate: 0 }))).toBeNull();
  });

  it('has none for a bar longer than the engine counts', () => {
    const beats = Array.from({ length: 40 }, (_, i) => i * 0.25);
    expect(
      countedStart(
        request({
          beats,
          downbeatIndices: [0, KB_MAX_BEATS + 1],
          headFrame: 0,
        }),
      ),
    ).toBeNull();
  });
});
