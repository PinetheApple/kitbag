import {
  KB_COUNT_IN_OFF,
  KB_RAMP_STATE,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  afterCountInSummary,
  armedRows,
  armedSummary,
  countInBarText,
  countSquare,
  CYCLE_STRIP_MAX_CELLS,
  cycleCellBar,
  cycleStripCells,
  LOWER_SLOT,
  NO_SLOT,
  UPPER_SLOT,
  NOTHING_ARMED,
  ofText,
  practiceBadgeCount,
  restLegend,
  spokenArmedSummary,
  rampNextText,
  rampRemainingText,
  rowSlot,
  shownRowCount,
  statusRows,
  type PracticeSettings,
  type StatusReads,
} from './statusRows.ts';
import { PRACTICE_OFF } from './fixtures.test-helper.ts';

const OFF = PRACTICE_OFF;

const ARMED: PracticeSettings = {
  ...OFF,
  ramp: { ...OFF.ramp, enabled: true },
  countIn: { ...OFF.countIn, bars: 1 },
};

const { KB_RAMP_STATE_OFF, KB_RAMP_STATE_STEPPING, KB_RAMP_STATE_AT_TARGET } =
  KB_RAMP_STATE;

describe('armed practice summary', () => {
  it('reads as the mockup draws it', () => {
    expect(armedSummary(ARMED)).toBe('Ramp 100 → 140 · Count-in 1 bar');
  });

  it('lists every armed tool', () => {
    const all = { ...ARMED, polyEnabled: true };
    const everything = {
      ...all,
      barMute: { ...all.barMute, enabled: true },
    };
    expect(armedSummary(everything)).toBe(
      'Ramp 100 → 140 · Mute 2+2 · Count-in 1 bar · Poly 3:4',
    );
  });

  it('spells the mute cycle out for a screen reader', () => {
    const everything = {
      ...ARMED,
      polyEnabled: true,
      barMute: { ...ARMED.barMute, enabled: true },
    };
    expect(spokenArmedSummary(everything)).toBe(
      'Ramp 100 → 140 · Mute bars: play 2, mute 2 · Count-in 1 bar · Poly 3:4',
    );
    expect(spokenArmedSummary(OFF)).toBe(NOTHING_ARMED);
  });

  it('reads an explicit poly cycle by its own count', () => {
    expect(armedSummary({ ...OFF, polyEnabled: true, polyAgainst: 2 })).toBe(
      'Poly 3:2',
    );
  });

  it('falls back to a neutral hint with nothing armed', () => {
    expect(armedSummary(OFF)).toBe(NOTHING_ARMED);
  });
});

describe('legend while stopped', () => {
  it('shows the poly legend instead of the beat legend while poly is on', () => {
    expect(restLegend(false, true)).toBe('poly');
    expect(restLegend(false, false)).toBe('beat');
  });

  it('hides every legend while running', () => {
    expect(restLegend(true, true)).toBeNull();
    expect(restLegend(true, false)).toBeNull();
  });
});

describe('practice badge', () => {
  it('counts ramp, mute bars, count-in and poly', () => {
    expect(practiceBadgeCount(OFF)).toBe(0);
    expect(practiceBadgeCount(ARMED)).toBe(2);
    expect(
      practiceBadgeCount({
        ...ARMED,
        polyEnabled: true,
        barMute: { ...ARMED.barMute, enabled: true },
      }),
    ).toBe(4);
  });
});

describe('after count-in summary', () => {
  it('lists only what starts once the count-in ends', () => {
    const everything = {
      ...ARMED,
      polyEnabled: true,
      barMute: { ...ARMED.barMute, enabled: true },
    };
    expect(afterCountInSummary(everything)).toBe('Ramp 100 → 140 · Mute 2+2');
    expect(afterCountInSummary(OFF)).toBe('');
  });
});

describe('statusRows', () => {
  const IDLE = {
    countingIn: 0,
    barMutePosition: -1,
    rampState: KB_RAMP_STATE_OFF,
  };
  const IN_CYCLE = { ...IDLE, barMutePosition: 2 };

  it('shows the count-in, then what follows it', () => {
    expect(statusRows({ ...IDLE, countingIn: 1 }, true)).toEqual({
      first: 'countIn',
      second: 'afterCountIn',
    });
    expect(statusRows({ ...IDLE, countingIn: 1 }, false)).toEqual({
      first: 'countIn',
      second: 'none',
    });
  });

  it('keeps the count-in up while the engine already reports the ramp', () => {
    expect(
      statusRows(
        {
          countingIn: 1,
          barMutePosition: 0,
          rampState: KB_RAMP_STATE_STEPPING,
        },
        true,
      ),
    ).toEqual({ first: 'countIn', second: 'afterCountIn' });
  });

  it('stacks the mute cycle above the ramp', () => {
    expect(
      statusRows({ ...IN_CYCLE, rampState: KB_RAMP_STATE_STEPPING }, true),
    ).toEqual({ first: 'mute', second: 'ramp' });
    expect(
      statusRows({ ...IN_CYCLE, rampState: KB_RAMP_STATE_AT_TARGET }, true),
    ).toEqual({ first: 'mute', second: 'reached' });
  });

  it('keeps the mute cycle up without a ramp', () => {
    expect(statusRows(IN_CYCLE, true)).toEqual({
      first: 'mute',
      second: 'none',
    });
  });

  it('moves a lone ramp to the first row', () => {
    expect(
      statusRows({ ...IDLE, rampState: KB_RAMP_STATE_STEPPING }, true),
    ).toEqual({ first: 'ramp', second: 'none' });
    expect(statusRows(IDLE, true)).toEqual({ first: 'none', second: 'none' });
  });

  it('places each row in its slot', () => {
    const rows = { first: 'mute', second: 'ramp' } as const;
    expect(rowSlot(rows, 'mute')).toBe(UPPER_SLOT);
    expect(rowSlot(rows, 'ramp')).toBe(LOWER_SLOT);
    expect(rowSlot(rows, 'countIn')).toBe(NO_SLOT);
  });

  it('drops a lone row to the lower slot, beside the player controls', () => {
    const rows = { first: 'ramp', second: 'none' } as const;
    expect(rowSlot(rows, 'ramp')).toBe(LOWER_SLOT);
    expect(rowSlot(rows, 'mute')).toBe(NO_SLOT);
  });
});

describe('live status text', () => {
  it('shows the next ramp tempo', () => {
    expect(rampNextText(123.6)).toBe('→ 124');
  });

  it('counts down in the ramp unit', () => {
    const { KB_RAMP_BARS, KB_RAMP_SECONDS, KB_RAMP_MINUTES } = KB_RAMP_UNIT;
    expect(rampRemainingText(3, KB_RAMP_BARS)).toBe('in 3 bars');
    expect(rampRemainingText(1, KB_RAMP_BARS)).toBe('in 1 bar');
    expect(rampRemainingText(11.2, KB_RAMP_SECONDS)).toBe('in 12 s');
    expect(rampRemainingText(1.42, KB_RAMP_MINUTES)).toBe('in 1.5 min');
    expect(rampRemainingText(2, KB_RAMP_MINUTES)).toBe('in 2 min');
    expect(rampRemainingText(0, KB_RAMP_SECONDS)).toBe('now');
  });

  it('numbers bars from one', () => {
    expect(ofText(2, 4)).toBe('3 of 4');
    expect(countInBarText(0, 2)).toBe('bar 1 of 2');
  });

  it('shows no count-in bar outside a running count-in', () => {
    expect(countInBarText(-1, 0)).toBe('');
    expect(countInBarText(0, 0)).toBe('');
    expect(countInBarText(-1, 2)).toBe('');
  });
});

describe('mute cycle strip', () => {
  it('shows a short cycle whole', () => {
    expect(cycleStripCells(4)).toBe(4);
    expect([0, 1, 2, 3].map((cell) => cycleCellBar(cell, 2, 4))).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('pages a long cycle so the current bar is always on the strip', () => {
    const cycle = 20;
    expect(cycleStripCells(cycle)).toBe(CYCLE_STRIP_MAX_CELLS);
    const cells = Array.from({ length: CYCLE_STRIP_MAX_CELLS }, (_u, i) => i);
    expect(cells.map((cell) => cycleCellBar(cell, 9, cycle))).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    expect(cells.map((cell) => cycleCellBar(cell, 17, cycle))).toEqual([
      16, 17, 18, 19, -1, -1, -1, -1,
    ]);
  });
});

describe('count-in squares', () => {
  it('marks counted, current and upcoming beats', () => {
    expect([0, 1, 2, 3].map((beat) => countSquare(beat, 2))).toEqual([
      'done',
      'done',
      'now',
      'upcoming',
    ]);
  });
});

describe('armedRows', () => {
  const STEPPING = KB_RAMP_STATE.KB_RAMP_STATE_STEPPING;
  const AT_TARGET = KB_RAMP_STATE.KB_RAMP_STATE_AT_TARGET;
  const ARMED_STATES = [false, true] as const;
  const shownRows = (reads: StatusReads, hasAfter: boolean) =>
    shownRowCount(statusRows(reads, hasAfter));

  function settingsFor(
    ramp: boolean,
    mute: boolean,
    countIn: boolean,
  ): PracticeSettings {
    return {
      ...OFF,
      ramp: { ...OFF.ramp, enabled: ramp },
      barMute: { ...OFF.barMute, enabled: mute },
      countIn: { ...OFF.countIn, bars: countIn ? 2 : KB_COUNT_IN_OFF },
    };
  }

  it('reserves no row with nothing armed, and ignores poly', () => {
    expect(armedRows(OFF)).toEqual({ countingIn: 0, played: 0 });
    expect(armedRows({ ...OFF, polyEnabled: true })).toEqual({
      countingIn: 0,
      played: 0,
    });
  });

  it('matches the rows the engine reads show, for every armed set', () => {
    for (const ramp of ARMED_STATES) {
      for (const mute of ARMED_STATES) {
        for (const countIn of ARMED_STATES) {
          const settings = settingsFor(ramp, mute, countIn);
          const armed = armedRows(settings);
          const hasAfter = afterCountInSummary(settings) !== '';
          const played = (rampState: number) => ({
            countingIn: 0,
            barMutePosition: mute ? 0 : -1,
            rampState: ramp ? rampState : KB_RAMP_STATE.KB_RAMP_STATE_OFF,
          });
          for (const rampState of [STEPPING, AT_TARGET]) {
            expect(shownRows(played(rampState), hasAfter)).toBe(armed.played);
          }
          const counting = {
            countingIn: countIn ? 1 : 0,
            barMutePosition: countIn || !mute ? -1 : 0,
            rampState: ramp ? STEPPING : KB_RAMP_STATE.KB_RAMP_STATE_OFF,
          };
          expect(shownRows(counting, hasAfter)).toBe(armed.countingIn);
        }
      }
    }
  });
});
