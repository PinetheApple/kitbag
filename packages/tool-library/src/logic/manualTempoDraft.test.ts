import { describe, expect, it } from 'vitest';

import {
  beatsFromBarOne,
  chosenTypedBpm,
  doubleOf,
  halfOf,
  markedAt,
  movedByBeats,
  noSeed,
  nudged,
  NUDGE_MS,
  shownTypedBpm,
  startDraft,
  stepped,
  tempoSeed,
  typedValue,
} from '@kitbag/core-design';
import { MANUAL_TEMPO_RULES as RULES } from '@kitbag/core-state';

const DURATION = 288;
const DRAFT = { bpm: 120, anchor: 2, beatsPerBar: 4, nudgedMs: 0 } as const;
const typed = (digits: string) => ({ digits, untouched: false });

describe('tempoSeed', () => {
  it('starts from the saved manual tempo', () => {
    const manualTempo = { bpm: 127.6, anchor: 1.5, beatsPerBar: 3 } as const;
    expect(
      tempoSeed(
        { manualTempo, analysedBpm: 132, barOneSeconds: 0, meter: 4 },
        RULES,
      ),
    ).toEqual({ ...manualTempo, analysed: false });
  });

  it('prefills from the analysis, bar 1 and meter included', () => {
    expect(
      tempoSeed(
        { manualTempo: null, analysedBpm: 131.96, barOneSeconds: 0.8, meter: 3 },
        RULES,
      ),
    ).toEqual({ bpm: 132, anchor: 0.8, beatsPerBar: 3, analysed: true });
  });

  it('falls back to 4/4 for a detected meter the override cannot hold', () => {
    const seed = tempoSeed(
      { manualTempo: null, analysedBpm: 100, barOneSeconds: 0, meter: 5 },
      RULES,
    );
    expect(seed.beatsPerBar).toBe(RULES.defaultMeter);
  });

  it('is empty with no grid at all', () => {
    expect(
      tempoSeed(
        { manualTempo: null, analysedBpm: null, barOneSeconds: 0, meter: 4 },
        RULES,
      ),
    ).toEqual(noSeed(RULES));
  });
});

describe('typed tempo', () => {
  it('keeps an untouched prefill exactly, decimals included', () => {
    const entry = { digits: '127.6', untouched: true };
    expect(chosenTypedBpm(entry, 127.6, RULES)).toBe(127.6);
    expect(shownTypedBpm(entry, 127.6)).toBe(127.6);
  });

  it('clamps a typed tempo into the range on confirm', () => {
    expect(chosenTypedBpm(typed('412'), null, RULES)).toBe(300);
    expect(chosenTypedBpm(typed('12'), null, RULES)).toBe(30);
    expect(chosenTypedBpm(typed(''), null, RULES)).toBeUndefined();
  });

  it('reads the raw typed value for the range hint', () => {
    expect(typedValue(typed('412'))).toBe(412);
  });

  it('halves and doubles to whole BPM, unclamped', () => {
    expect(halfOf(127)).toBe(64);
    expect(doubleOf(412)).toBe(824);
  });
});

describe('bar 1 moves', () => {
  it('starts at the seed bar 1, else at the playhead', () => {
    const empty = noSeed(RULES);
    expect(startDraft(128, empty, 41.2, RULES).anchor).toBe(41.2);
    expect(
      startDraft(128, { ...empty, anchor: 0.8 }, 41.2, RULES).anchor,
    ).toBe(0.8);
  });

  it('moves a whole beat at the draft tempo', () => {
    expect(movedByBeats(DRAFT, 1, DURATION, RULES).anchor).toBe(2.5);
    expect(movedByBeats(DRAFT, -1, DURATION, RULES).anchor).toBe(1.5);
  });

  it('never moves bar 1 before the start of the song', () => {
    expect(movedByBeats(DRAFT, -5, DURATION, RULES).anchor).toBe(0);
  });

  it('nudges by 10 ms and adds the nudges up', () => {
    const once = nudged(DRAFT, NUDGE_MS, DURATION, RULES);
    const twice = nudged(once, NUDGE_MS, DURATION, RULES);
    expect(twice.anchor).toBe(2.02);
    expect(twice.nudgedMs).toBe(2 * NUDGE_MS);
  });

  it('forgets the nudges when bar 1 is marked again', () => {
    const moved = nudged(DRAFT, NUDGE_MS, DURATION, RULES);
    expect(markedAt(moved, 7)).toEqual({ ...DRAFT, anchor: 7, nudgedMs: 0 });
  });

  it('steps the tempo by a tenth', () => {
    expect(stepped(DRAFT, 1, RULES).bpm).toBe(120.1);
    expect(stepped(DRAFT, -1, RULES).bpm).toBe(119.9);
  });

  it('places the playhead in beats from bar 1', () => {
    expect(beatsFromBarOne(3, DRAFT)).toBe(2);
    expect(beatsFromBarOne(1.5, DRAFT)).toBe(-1);
  });
});
