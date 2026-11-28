import {
  BEAT_SOURCE,
  TAP_LOCK_MISS,
  TAP_STEP,
  TAPS_TO_SET_TEMPO,
  type TapAlong,
  type TapLockResult,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { PAD_ACTION } from './tapAlongCopy.ts';
import {
  TAP_PAD_MODE,
  TAP_TEMPO_TITLE,
  tapPadCopy,
  tapsLeftHint,
  type TapPadInputs,
} from './tapPad.ts';

const SONG_BPM = 171;
const TAPPED_BPM = 96;
const TWO_TAPS = 2;
const HALF_TIME_BPM = 85.5;
const DOUBLE_TIME_BPM = 342;
const DISAGREE_BPM = 140;
const UNSURE_BPM = 164;
const KEPT_SIX = 6;
const MOVED_TWO = 2;

const noTaps: TapAlong = {
  step: TAP_STEP.tapping,
  taps: [],
  offsets: [],
  result: undefined,
  halfOrDoubleBpm: undefined,
  tempoChoice: undefined,
  movedBeats: 0,
  cleared: undefined,
};

const locked: TapLockResult = {
  locked: true,
  bpm: SONG_BPM,
  beatSource: BEAT_SOURCE.song,
  anchorMs: 0,
  beatMs: 1,
  gridMs: 1,
  spreadMs: 0,
  keptTaps: TAPS_TO_SET_TEMPO,
};

const refused = (
  reason: (typeof TAP_LOCK_MISS)[keyof typeof TAP_LOCK_MISS],
  tappedBpm: number | null = null,
): TapLockResult => ({ locked: false, reason, spreadMs: null, tappedBpm });

function tapped(
  offsets: readonly number[],
  ignored: readonly number[] = [],
  result?: TapLockResult,
): TapAlong {
  return {
    ...noTaps,
    taps: offsets.map((_ms, i) => i),
    offsets: offsets.map((ms, i) => ({ ms, kept: !ignored.includes(i) })),
    result,
  };
}

const idle: TapPadInputs = {
  following: false,
  locked: false,
  playing: true,
  songBpm: null,
  tappedBpm: null,
  tapsLanded: 0,
  retap: false,
  offered: false,
  tapAlong: noTaps,
};

const song: TapPadInputs = { ...idle, following: true, songBpm: SONG_BPM };

describe('the idle pad (state a)', () => {
  it('asks to tap along once a song plays and its tempo is known', () => {
    expect(tapPadCopy(song)).toMatchObject({
      mode: TAP_PAD_MODE.along,
      title: 'Tap along to the beat',
      hint: 'Four taps or more. Start on a 1 if you can.',
      leds: null,
      active: false,
    });
  });

  it('says the taps set the tempo too when no rung found one', () => {
    expect(tapPadCopy({ ...song, songBpm: null }).hint).toBe(
      'Your taps set the tempo and the beat. Four or more.',
    );
  });

  it('offers locking by hand while the library grid is offered', () => {
    expect(tapPadCopy({ ...song, offered: true }).hint).toBe(
      'Or tap along to lock it yourself',
    );
  });
});

describe('the tapping pad (state b)', () => {
  it('counts taps, lights LEDs and badges each offset in ms', () => {
    const copy = tapPadCopy({ ...song, tapAlong: tapped([-6, 4, -8]) });
    expect(copy).toMatchObject({
      title: 'Keep tapping',
      hint: '3 of 4 taps · last one 8 ms early',
      leds: 3,
      active: true,
    });
    expect(copy.badges.map((b) => b.label)).toEqual([
      '−6 ms',
      '+4 ms',
      '−8 ms',
    ]);
  });

  it('says it can lock once four taps agree, naming the ignored one', () => {
    const copy = tapPadCopy({
      ...song,
      tapAlong: tapped([-6, 4, 74, -8, 3], [2], locked),
    });
    expect(copy).toMatchObject({
      title: 'Keep tapping, or stop to lock',
      hint: '4 taps agree within 8 ms · 1 ignored',
      leds: TAPS_TO_SET_TEMPO,
    });
    expect(copy.badges).toEqual([
      { label: '−6', ignored: false },
      { label: '+4', ignored: false },
      { label: '+74 ignored', ignored: true },
      { label: '−8', ignored: false },
      { label: '+3', ignored: false },
    ]);
  });

  it('asks for more taps when they are only slightly off the song', () => {
    const copy = tapPadCopy({
      ...song,
      tapAlong: tapped(
        [0, 0, 0, 0],
        [],
        refused(TAP_LOCK_MISS.unsure, UNSURE_BPM),
      ),
    });
    expect(copy.title).toBe('Keep tapping');
    expect(copy.hint).toBe(
      'Your taps say 164, the song says 171. A few more will settle it.',
    );
  });
});

describe('choosing the 1 (state d)', () => {
  const choosing = { ...noTaps, step: TAP_STEP.chooseOne };

  it('asks for one tap on the 1 with a way to skip it', () => {
    const copy = tapPadCopy({ ...song, locked: true, tapAlong: choosing });
    expect(copy).toMatchObject({
      mode: TAP_PAD_MODE.along,
      title: 'Now tap once on the 1',
      hint: 'Where the bar starts. Near is fine: it snaps to the closest beat.',
      action: PAD_ACTION.accentRight,
      leds: null,
    });
  });

  it('says half-time taps worked and kept the song tempo', () => {
    const copy = tapPadCopy({
      ...song,
      locked: true,
      tapAlong: { ...choosing, halfOrDoubleBpm: HALF_TIME_BPM },
    });
    expect(copy.hint).toBe(
      'You tapped every other beat (85.5). That works: tempo stays 171.',
    );
  });

  it('says double-time taps worked and kept the song tempo', () => {
    const copy = tapPadCopy({
      ...song,
      locked: true,
      tapAlong: { ...choosing, halfOrDoubleBpm: DOUBLE_TIME_BPM },
    });
    expect(copy.hint).toBe(
      'You tapped twice a beat (342). That works: tempo stays 171.',
    );
  });

  it('confirms beat 1 and how far the accent moved', () => {
    const copy = tapPadCopy({
      ...song,
      locked: true,
      tapAlong: { ...noTaps, step: TAP_STEP.oneSet, movedBeats: MOVED_TWO },
    });
    expect(copy).toMatchObject({
      title: 'Beat 1 is set',
      hint: 'Moved the accent 2 beats. The click follows the song from here.',
      active: true,
    });
  });

  it('confirms beat 1 without a move when the accent was right', () => {
    const copy = tapPadCopy({
      ...song,
      locked: true,
      tapAlong: { ...noTaps, step: TAP_STEP.oneSet },
    });
    expect(copy.hint).toBe('The click follows the song from here.');
  });
});

describe('re-tap (state e)', () => {
  it('counts the re-tap and says the tempo and the 1 stay', () => {
    const copy = tapPadCopy({
      ...song,
      locked: true,
      retap: true,
      tapAlong: tapped([0, 0]),
    });
    expect(copy).toMatchObject({
      title: 'Tap along to re-align',
      hint: '2 of 4 taps · tempo stays 171 and the 1 stays put',
      leds: TWO_TAPS,
      badges: [],
      active: true,
    });
  });
});

describe('edges (state f)', () => {
  it('says the taps are uneven, how many were off, and offers a restart', () => {
    const offsets = [-6, 92, 31, -71, 12, 88, -20];
    const copy = tapPadCopy({
      ...song,
      tapAlong: tapped(offsets, [1, 3, 5], refused(TAP_LOCK_MISS.spread)),
    });
    expect(copy).toMatchObject({
      title: 'Taps are uneven',
      hint: '3 of 7 were more than 60 ms off. Keep tapping, or follow the kick drum.',
      action: PAD_ACTION.startOver,
    });
    expect(copy.badges.filter((b) => b.ignored)).toHaveLength(3);
  });

  it('keeps the taps through a pause and says so', () => {
    const copy = tapPadCopy({
      ...song,
      playing: false,
      tapAlong: tapped([0, 0]),
    });
    expect(copy).toMatchObject({
      title: 'Paused · 2 taps kept',
      hint: 'Taps are kept in song time. Play and carry on tapping.',
      leds: TWO_TAPS,
      badges: [],
    });
  });

  it('asks for a tempo before the 1 when the taps disagree', () => {
    const copy = tapPadCopy({
      ...song,
      locked: true,
      tapAlong: {
        ...noTaps,
        step: TAP_STEP.chooseTempo,
        tempoChoice: {
          tappedBpm: DISAGREE_BPM,
          songBpm: SONG_BPM,
          keptTaps: KEPT_SIX,
          tappedDownbeatSec: 0,
        },
      },
    });
    expect(copy.title).toBe('Locked from 6 taps');
    expect(copy.hint).toBe('Pick a tempo above, then tap once on the 1.');
  });
});

describe('tap tempo and the held pad', () => {
  it('is tap tempo with no song, even when a tempo is known', () => {
    const copy = tapPadCopy({
      ...idle,
      songBpm: SONG_BPM,
      tapsLanded: TWO_TAPS,
    });
    expect(copy).toMatchObject({
      mode: TAP_PAD_MODE.tempo,
      title: TAP_TEMPO_TITLE,
      hint: '2 more taps',
      leds: TWO_TAPS,
    });
  });

  it('says taps light up before the first one lands', () => {
    expect(tapPadCopy(idle).hint).toBe('Taps light up as they land');
  });

  it('offers to change a tapped tempo once it is set', () => {
    const copy = tapPadCopy({
      ...idle,
      tappedBpm: TAPPED_BPM,
      tapsLanded: TAPS_TO_SET_TEMPO,
    });
    expect(copy.hint).toBe('96 BPM · tap again to change');
  });

  it('holds the lock on the pad while the finger is down', () => {
    expect(tapPadCopy({ ...song, locked: true })).toMatchObject({
      mode: TAP_PAD_MODE.landed,
      title: 'Locked on beat 1',
    });
  });

  it('keeps the lock on the pad while the followed app is gone', () => {
    const copy = tapPadCopy({ ...idle, locked: true, songBpm: SONG_BPM });
    expect(copy.mode).toBe(TAP_PAD_MODE.landed);
  });

  it('counts the same taps in its title as the tempo needs', () => {
    const FOUR = 4;
    expect(TAPS_TO_SET_TEMPO).toBe(FOUR);
    expect(TAP_TEMPO_TITLE).toContain('four');
  });
});

describe('tapsLeftHint', () => {
  it('counts down to the tap that sets the tempo', () => {
    expect(tapsLeftHint(TAPS_TO_SET_TEMPO - 1)).toBe('1 more tap');
    expect(tapsLeftHint(0)).toBe(`${String(TAPS_TO_SET_TEMPO)} more taps`);
  });
});
