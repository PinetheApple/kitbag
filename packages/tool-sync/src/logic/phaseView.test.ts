import { describe, expect, it } from 'vitest';

import {
  beatShareHint,
  downbeatLabel,
  heardSpeed,
  phaseRangeEnds,
  phaseStepFromOption,
  PHASE_STEP_OPTIONS,
  phaseThumbFraction,
  phaseTotal,
} from './phaseView.ts';

const LIMIT_AT_171 = 30000 / 171;

describe('beatShareHint', () => {
  it('says how much of a beat the nudge is at the heard tempo', () => {
    expect(beatShareHint(10, LIMIT_AT_171, 171)).toBe(
      '2.9% of a beat at 171 BPM',
    );
  });

  it('reads the share without a sign or a trailing zero', () => {
    expect(beatShareHint(-60000 / 171 / 4, LIMIT_AT_171, 171)).toBe(
      '25% of a beat at 171 BPM',
    );
    expect(beatShareHint(0, LIMIT_AT_171, 171)).toBe('0% of a beat at 171 BPM');
  });
});

describe('phaseRangeEnds', () => {
  it('names both half-beat ends with their milliseconds', () => {
    expect(phaseRangeEnds(LIMIT_AT_171)).toEqual({
      start: '−½ beat · −175 ms',
      end: '+175 ms · +½ beat',
    });
  });
});

describe('phaseThumbFraction', () => {
  it('centres zero and puts the limits at the ends', () => {
    expect(phaseThumbFraction(0, 175)).toBe(0.5);
    expect(phaseThumbFraction(175, 175)).toBe(1);
    expect(phaseThumbFraction(-175, 175)).toBe(0);
  });

  it('keeps the thumb on the track past the limit', () => {
    expect(phaseThumbFraction(400, 175)).toBe(1);
  });
});

describe('phaseTotal', () => {
  it('adds the route and the song nudge and names both parts', () => {
    expect(phaseTotal(180, 10)).toEqual({
      total: '+190 ms total',
      parts: '· 180 route + 10 song',
    });
  });

  it('signs a negative route and subtracts a negative nudge', () => {
    expect(phaseTotal(-20, -30)).toEqual({
      total: '−50 ms total',
      parts: '· −20 route − 30 song',
    });
  });
});

describe('downbeatLabel', () => {
  it('counts the shifted downbeat from beat 1', () => {
    expect(downbeatLabel(0)).toBe('Beat 1');
    expect(downbeatLabel(2)).toBe('Beat 3');
  });
});

describe('phase step options', () => {
  it('offers 1, 10 and 50 ms and maps a pick back to its step', () => {
    expect(PHASE_STEP_OPTIONS.map((option) => option.label)).toEqual([
      '1 ms',
      '10 ms',
      '50 ms',
    ]);
    expect(phaseStepFromOption('50')).toBe(50);
    expect(phaseStepFromOption('7')).toBeUndefined();
  });
});

describe('heardSpeed', () => {
  it('reads the followed app speed and falls back to normal speed', () => {
    expect(heardSpeed({ speed: 1.5 })).toBe(1.5);
    expect(heardSpeed({ speed: 0 })).toBe(1);
    expect(heardSpeed(undefined)).toBe(1);
  });
});
