// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SongTempoCorrection } from './useSongTempoCorrection.ts';

const SONG = 7;
const DETECTED_BPM = 104;

const player = vi.hoisted(() => ({ correction: 'none', saves: true }));
const apply = vi.hoisted(() =>
  vi.fn((_song: number, next: string) => {
    player.correction = next;
  }),
);
const save = vi.hoisted(() => vi.fn(() => Promise.resolve(player.saves)));
const settle = vi.hoisted(() => vi.fn());

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongPlayer: (select: (state: unknown) => unknown) =>
    select({
      tempoCorrection: player.correction,
      detectedBpm: DETECTED_BPM,
    }),
  useLiveSongPlayer: (select: (state: unknown) => unknown) =>
    select({
      tempoCorrectionChanged: apply,
      tempoCorrectionSettled: settle,
    }),
  useSongLibrary: (select: (state: unknown) => unknown) =>
    select({ saveSongTempoCorrection: save }),
}));

const { TEMPO_CORRECTION } = await import('@kitbag/core-state');
const { useSongTempoCorrection } = await import('./useSongTempoCorrection.ts');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let hook: SongTempoCorrection | null = null;
let tree: ReactTestRenderer | null = null;

function Probe() {
  hook = useSongTempoCorrection(SONG);
  return null;
}

function current(): SongTempoCorrection {
  if (hook === null) throw new Error('not mounted');
  return hook;
}

async function mounted() {
  await act(async () => {
    tree = create(createElement(Probe));
    await Promise.resolve();
  });
}

async function tap(run: (hook: SongTempoCorrection) => void) {
  await act(async () => {
    run(current());
    await Promise.resolve();
  });
}

function holdNextSave() {
  let finish: (saved: boolean) => void = () => undefined;
  save.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  return (saved: boolean) => {
    finish(saved);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hook = null;
  tree = null;
  player.correction = TEMPO_CORRECTION.none;
  player.saves = true;
});

describe('the song tempo correction', () => {
  it('applies a pick live, saves it and notes it with Undo', async () => {
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.threeHalves);
    });
    expect(apply).toHaveBeenCalledExactlyOnceWith(
      SONG,
      TEMPO_CORRECTION.threeHalves,
    );
    expect(save).toHaveBeenCalledExactlyOnceWith(
      SONG,
      TEMPO_CORRECTION.threeHalves,
    );
    expect(current().notice).toMatchObject({
      message: 'Tempo set to ×3/2 · 156 BPM. Saved for this song.',
      spokenMessage:
        'Tempo set to one and a half times, 156 BPM. Saved for this song.',
      actionLabel: 'Undo',
    });
  });

  it('ignores the factor already applied', async () => {
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.none);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('undo puts the previous factor back and says nothing more', async () => {
    player.correction = TEMPO_CORRECTION.double;
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.half);
    });
    await tap((h) => {
      h.notice?.onAction();
    });
    expect(save).toHaveBeenLastCalledWith(SONG, TEMPO_CORRECTION.double);
    expect(player.correction).toBe(TEMPO_CORRECTION.double);
    expect(current().notice).toBeNull();
  });

  it('notes ×1 as back to the detected tempo', async () => {
    player.correction = TEMPO_CORRECTION.double;
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.none);
    });
    expect(current().notice?.message).toBe(
      'Back to the detected tempo. Saved for this song.',
    );
  });

  it('puts the grid back when the save fails and offers Try again', async () => {
    player.saves = false;
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.double);
    });
    expect(player.correction).toBe(TEMPO_CORRECTION.none);
    expect(current().notice).toMatchObject({
      message: 'Could not save the tempo correction.',
      actionLabel: 'Try again',
    });
    player.saves = true;
    await tap((h) => {
      h.notice?.onAction();
    });
    expect(player.correction).toBe(TEMPO_CORRECTION.double);
  });

  it('saves the last pick made during a running save', async () => {
    const finish = holdNextSave();
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.double);
    });
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.half);
      h.onPick(TEMPO_CORRECTION.threeHalves);
    });
    expect(save).toHaveBeenCalledOnce();
    await act(async () => {
      finish(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(SONG, TEMPO_CORRECTION.threeHalves);
    expect(player.correction).toBe(TEMPO_CORRECTION.threeHalves);
  });

  it('hides the Undo note as soon as a new pick starts', async () => {
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.double);
    });
    expect(current().notice?.actionLabel).toBe('Undo');
    holdNextSave();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.threeHalves);
    });
    expect(current().notice).toBeNull();
  });

  it('never shows the earlier pick once a later one is made during its save', async () => {
    const finish = holdNextSave();
    await mounted();
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.double);
    });
    await tap((h) => {
      h.onPick(TEMPO_CORRECTION.threeHalves);
    });
    expect(current().correction).toBe(TEMPO_CORRECTION.threeHalves);
    player.correction = TEMPO_CORRECTION.double;
    await act(async () => {
      tree?.update(createElement(Probe));
      await Promise.resolve();
    });
    expect(current().correction).toBe(TEMPO_CORRECTION.threeHalves);
    await act(async () => {
      finish(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(current().correction).toBe(TEMPO_CORRECTION.threeHalves);
    expect(settle).toHaveBeenCalledExactlyOnceWith(SONG);
  });
});
