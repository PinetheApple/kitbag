import { describe, expect, it } from 'vitest';

import { beatTicks, tickPath } from './beatTicks.ts';
import { songPlayer } from './stemPlayerRoles.ts';

const MIN_GAP = songPlayer.beatTickMinGap;
const BEATS_PER_BAR = 4;
const LANE = 350;
const SECONDS_PER_MINUTE = 60;
const EVEN_WITHIN = 1;

function evenGrid(bpm: number, durationSec: number) {
  const step = SECONDS_PER_MINUTE / bpm;
  const beats = Array.from(
    { length: Math.floor(durationSec / step) },
    (_, i) => i * step,
  );
  const downbeats = beats
    .map((_, i) => i)
    .filter((i) => i % BEATS_PER_BAR === 0);
  return { beats, downbeats };
}

function gaps(ticks: readonly { readonly x: number }[]) {
  return ticks.slice(1).map((tick, i) => tick.x - (ticks[i]?.x ?? 0));
}

describe('beatTicks', () => {
  it('places a beat by its share of the song across the width', () => {
    expect(beatTicks([5], [], 10, 300, MIN_GAP)).toEqual([
      { x: 150, tall: false },
    ]);
  });

  it('marks downbeats by their index in the grid', () => {
    expect(beatTicks([1, 5], [1], 10, 300, MIN_GAP)).toEqual([
      { x: 30, tall: false },
      { x: 150, tall: true },
    ]);
  });

  it('draws every beat, tall on downbeats, while beats fit: 60 BPM over 30 s', () => {
    const { beats, downbeats } = evenGrid(60, 30);
    const ticks = beatTicks(beats, downbeats, 30, LANE, MIN_GAP);
    expect(ticks).toHaveLength(beats.length);
    expect(ticks.map((tick) => tick.tall)).toEqual(
      beats.map((_, i) => i % BEATS_PER_BAR === 0),
    );
  });

  it('thins 172 BPM over 3:00 to every second bar, evenly spaced', () => {
    const { beats, downbeats } = evenGrid(172, 180);
    const ticks = beatTicks(beats, downbeats, 180, LANE, MIN_GAP);
    const stride = 2;
    expect(ticks.every((tick) => tick.tall)).toBe(true);
    expect(ticks.map((tick) => tick.x)).toEqual(
      downbeats
        .filter((_, bar) => bar % stride === 0)
        .map((i) => ((beats[i] ?? 0) / 180) * LANE),
    );
    const spacing = gaps(ticks);
    expect(Math.min(...spacing)).toBeGreaterThanOrEqual(MIN_GAP);
    expect(Math.max(...spacing) - Math.min(...spacing)).toBeLessThan(
      EVEN_WITHIN,
    );
  });

  it('thins a dense grid with no downbeats to every Nth beat, all short', () => {
    const beats = Array.from({ length: 2000 }, (_, i) => i * 0.15);
    const ticks = beatTicks(beats, [], 300, 360, MIN_GAP);
    const stride = 32;
    expect(ticks.some((tick) => tick.tall)).toBe(false);
    expect(ticks.map((tick) => tick.x)).toEqual(
      beats
        .filter((_, i) => i % stride === 0)
        .map((beat) => (beat / 300) * 360),
    );
    expect(Math.min(...gaps(ticks))).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('keeps the bar stride on bar indices when the tempo drifts', () => {
    const barSeconds = [2, 2, 1, 1, 1, 1, 2, 2];
    const downbeatTimes = barSeconds.map((_, bar) =>
      barSeconds.slice(0, bar).reduce((sum, length) => sum + length, 0),
    );
    const beats = downbeatTimes.flatMap((start, bar) =>
      Array.from(
        { length: BEATS_PER_BAR },
        (_, beat) => start + ((barSeconds[bar] ?? 0) * beat) / BEATS_PER_BAR,
      ),
    );
    const downbeats = downbeatTimes.map((_, bar) => bar * BEATS_PER_BAR);
    const durationSec = 12;
    const width = 24;
    const ticks = beatTicks(beats, downbeats, durationSec, width, MIN_GAP);
    expect(ticks).toEqual(
      [0, 2, 4, 6].map((bar) => ({
        x: ((downbeatTimes[bar] ?? 0) / durationSec) * width,
        tall: true,
      })),
    );
  });

  it('ends on a grid whose beats share a time', () => {
    expect(beatTicks([1, 1, 1], [0, 1, 2], 10, 300, MIN_GAP)).toEqual([
      { x: 30, tall: true },
    ]);
  });

  it('drops beats past the end of the song', () => {
    expect(beatTicks([5, 11], [], 10, 300, MIN_GAP)).toHaveLength(1);
  });

  it.each([
    ['no duration', 0, 300],
    ['no width yet', 10, 0],
  ])('has no ticks with %s', (_, duration, width) => {
    expect(beatTicks([1], [], duration, width, MIN_GAP)).toEqual([]);
  });
});

describe('tickPath', () => {
  it('stands each tick on the floor of the lane', () => {
    expect(tickPath([{ x: 3, tall: false }], 64, 8)).toBe('M3 64V56');
  });
});
