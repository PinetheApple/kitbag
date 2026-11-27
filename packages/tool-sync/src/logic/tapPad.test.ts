import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

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

const idle: TapPadInputs = {
  following: false,
  locked: false,
  songBpm: null,
  tappedBpm: null,
  tapsLanded: 0,
  retap: false,
};

describe('tapPadCopy', () => {
  it('asks for a downbeat once a song plays and its tempo is known', () => {
    const copy = tapPadCopy({ ...idle, following: true, songBpm: SONG_BPM });
    expect(copy.mode).toBe(TAP_PAD_MODE.align);
    expect(copy.title).toBe('Tap on a downbeat');
    expect(copy.hint).toBe('One tap locks the click to the song');
  });

  it('says what the tap did once the click locked', () => {
    const copy = tapPadCopy({
      ...idle,
      following: true,
      locked: true,
      songBpm: SONG_BPM,
    });
    expect(copy.mode).toBe(TAP_PAD_MODE.landed);
    expect(copy.title).toBe('Locked on beat 1');
  });

  it('asks for a re-tap on a downbeat when the lock drifted', () => {
    const copy = tapPadCopy({
      ...idle,
      following: true,
      locked: true,
      retap: true,
      songBpm: SONG_BPM,
    });
    expect(copy.mode).toBe(TAP_PAD_MODE.align);
    expect(copy.title).toBe('Re-tap on a downbeat');
    expect(copy.hint).toBe('One tap puts the click back on the beat');
  });

  it('switches to tap tempo when every rung failed for the song', () => {
    const copy = tapPadCopy({ ...idle, following: true, tapsLanded: TWO_TAPS });
    expect(copy.mode).toBe(TAP_PAD_MODE.tempo);
    expect(copy.title).toBe('Tap four times on the beat');
    expect(copy.hint).toBe('2 more taps');
  });

  it('is tap tempo with no song, even when a tempo is known', () => {
    expect(tapPadCopy({ ...idle, songBpm: SONG_BPM }).mode).toBe(
      TAP_PAD_MODE.tempo,
    );
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
});

describe('tapsLeftHint', () => {
  it('counts down to the tap that sets the tempo', () => {
    expect(tapsLeftHint(TAPS_TO_SET_TEMPO - 1)).toBe('1 more tap');
    expect(tapsLeftHint(0)).toBe(`${String(TAPS_TO_SET_TEMPO)} more taps`);
  });
});
