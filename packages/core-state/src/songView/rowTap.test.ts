import { describe, expect, it } from 'vitest';

import { ROW_TAP, rowTap, type OpenPlayers } from './rowTap.ts';

const SHOWN = 3;
const OTHER = 4;

const closed: OpenPlayers = {
  song: { status: 'idle', songId: null },
  stems: { status: 'idle', setId: null },
};

function songOpen(status: OpenPlayers['song']['status']): OpenPlayers {
  return { ...closed, song: { status, songId: SHOWN } };
}

describe('a Songs or Stem songs row tap', () => {
  it('opens the open song as it is', () => {
    expect(rowTap({ kind: 'song', id: SHOWN }, songOpen('ready'))).toBe(
      ROW_TAP.asIs,
    );
    const stems: OpenPlayers = {
      ...closed,
      stems: { status: 'ready', setId: SHOWN },
    };
    expect(rowTap({ kind: 'stems', id: SHOWN }, stems)).toBe(ROW_TAP.asIs);
  });

  it('opens a song still loading as it is', () => {
    expect(rowTap({ kind: 'song', id: SHOWN }, songOpen('loading'))).toBe(
      ROW_TAP.asIs,
    );
  });

  it('views any other song', () => {
    expect(rowTap({ kind: 'song', id: OTHER }, songOpen('ready'))).toBe(
      ROW_TAP.view,
    );
    expect(rowTap({ kind: 'stems', id: SHOWN }, songOpen('ready'))).toBe(
      ROW_TAP.view,
    );
  });

  it('opens the song live when no song holds the session', () => {
    expect(rowTap({ kind: 'song', id: SHOWN }, songOpen('failed'))).toBe(
      ROW_TAP.asIs,
    );
    expect(rowTap({ kind: 'song', id: OTHER }, closed)).toBe(ROW_TAP.asIs);
    expect(rowTap({ kind: 'stems', id: OTHER }, closed)).toBe(ROW_TAP.asIs);
  });

  it('views a song while a stem song holds the session', () => {
    const stems: OpenPlayers = {
      ...closed,
      stems: { status: 'loading', setId: SHOWN },
    };
    expect(rowTap({ kind: 'song', id: OTHER }, stems)).toBe(ROW_TAP.view);
  });
});
