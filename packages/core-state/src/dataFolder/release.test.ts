import { describe, expect, it } from 'vitest';

import {
  NO_TRACKS,
  oldRootReleased,
  playerTracks,
  stillHolding,
} from './release.ts';

const SONG = 4;
const SET = 9;

describe('playerTracks', () => {
  it('counts a closed player as holding nothing', () => {
    expect(
      playerTracks(
        { status: 'idle', songId: SONG },
        { status: 'idle', setId: SET },
      ),
    ).toEqual(NO_TRACKS);
  });

  it('names what an open or loading player holds', () => {
    expect(
      playerTracks(
        { status: 'ready', songId: SONG },
        { status: 'loading', setId: SET },
      ),
    ).toEqual({ song: SONG, stems: SET });
  });
});

describe('stillHolding', () => {
  const atSwitch = { song: SONG, stems: SET };

  it('keeps holding while the same tracks stay open', () => {
    const held = stillHolding(atSwitch, atSwitch);
    expect(oldRootReleased(held)).toBe(false);
  });

  it('waits for the stem player even once the song player closed', () => {
    const held = stillHolding(atSwitch, { song: null, stems: SET });
    expect(held).toEqual({ song: null, stems: SET });
    expect(oldRootReleased(held)).toBe(false);
  });

  it('waits for the song player even once the stem player closed', () => {
    const held = stillHolding(atSwitch, { song: SONG, stems: null });
    expect(oldRootReleased(held)).toBe(false);
  });

  it('releases a player that opened something else', () => {
    const held = stillHolding(atSwitch, { song: SONG + 1, stems: SET + 1 });
    expect(oldRootReleased(held)).toBe(true);
  });

  it('stays released when a player reopens the same song after closing', () => {
    const closed = stillHolding(atSwitch, NO_TRACKS);
    expect(oldRootReleased(stillHolding(closed, atSwitch))).toBe(true);
  });

  it('releases at once when nothing was open at the switch', () => {
    expect(oldRootReleased(stillHolding(NO_TRACKS, atSwitch))).toBe(true);
  });
});
