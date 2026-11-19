// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SongMeter } from './useSongMeter.ts';

const SONG = 7;
const NONE = { meterBeatsPerBar: null, barOneSeconds: null };

interface Choice {
  meterBeatsPerBar: number | null;
  barOneSeconds: number | null;
}

const player = vi.hoisted(
  (): { override: Choice; beat: number | null; saves: boolean } => ({
    override: { meterBeatsPerBar: null, barOneSeconds: null },
    beat: 105.3,
    saves: true,
  }),
);

const apply = vi.hoisted(() =>
  vi.fn((_song: number, next: Choice) => {
    player.override = next;
  }),
);
const save = vi.hoisted(() => vi.fn(() => Promise.resolve(player.saves)));

vi.mock('@kitbag/core-state', () => ({
  GRID_METERS: [3, 4],
  NO_METER_OVERRIDE: { meterBeatsPerBar: null, barOneSeconds: null },
  useSongPlayer: (select: (state: unknown) => unknown) =>
    select({
      meterOverride: player.override,
      detected: { meter: 4, barOneSeconds: 2.3 },
      meterOverrideChanged: apply,
      playheadBeatSeconds: () => player.beat,
    }),
  useSongLibrary: (select: (state: unknown) => unknown) =>
    select({ saveSongMeterOverride: save }),
}));

const { useSongMeter } = await import('./useSongMeter.ts');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let meter: SongMeter | null = null;

function Probe() {
  meter = useSongMeter(SONG);
  return null;
}

function current(): SongMeter {
  if (meter === null) throw new Error('not mounted');
  return meter;
}

async function mounted() {
  await act(async () => {
    create(createElement(Probe));
    await Promise.resolve();
  });
}

async function tap(run: (meter: SongMeter) => void) {
  await act(async () => {
    run(current());
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  meter = null;
  player.override = NONE;
  player.beat = 105.3;
  player.saves = true;
});

describe('the song meter', () => {
  it('applies a picked meter live and saves it once', async () => {
    await mounted();
    await tap((m) => {
      m.onPickMeter(3);
    });
    const next = { meterBeatsPerBar: 3, barOneSeconds: null };
    expect(apply).toHaveBeenCalledExactlyOnceWith(SONG, next);
    expect(save).toHaveBeenCalledExactlyOnceWith(SONG, next);
    expect(current().undo?.message).toBe(
      'Meter set to 3/4. Saved for this song.',
    );
  });

  it('ignores the meter already shown', async () => {
    await mounted();
    await tap((m) => {
      m.onPickMeter(4);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('saves the beat nearest the playhead as bar 1', async () => {
    await mounted();
    await tap((m) => {
      m.onBarOneHere();
    });
    expect(save).toHaveBeenCalledExactlyOnceWith(SONG, {
      meterBeatsPerBar: null,
      barOneSeconds: 105.3,
    });
    expect(current().undo?.message).toBe(
      'Bar 1 moved to 1:45.3. Saved for this song.',
    );
  });

  it('does nothing for bar 1 without a grid', async () => {
    player.beat = null;
    await mounted();
    await tap((m) => {
      m.onBarOneHere();
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('undo restores and saves the previous override', async () => {
    const before = { meterBeatsPerBar: 4, barOneSeconds: 1 };
    player.override = before;
    await mounted();
    await tap((m) => {
      m.onPickMeter(3);
    });
    await tap((m) => {
      m.undo?.onAction();
    });
    expect(save).toHaveBeenLastCalledWith(SONG, before);
    expect(player.override).toEqual(before);
    expect(current().undo).toBeNull();
  });

  it('back to detected clears meter and bar 1 together', async () => {
    player.override = { meterBeatsPerBar: 3, barOneSeconds: 1 };
    await mounted();
    await tap((m) => {
      m.onReset();
    });
    expect(save).toHaveBeenCalledExactlyOnceWith(SONG, NONE);
  });

  it('puts the bars back when the save fails, offering no undo', async () => {
    player.saves = false;
    await mounted();
    await tap((m) => {
      m.onPickMeter(3);
    });
    expect(player.override).toEqual(NONE);
    expect(apply).toHaveBeenLastCalledWith(SONG, NONE);
    expect(current().undo).toBeNull();
  });
});
