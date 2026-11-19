import { TEMPO_MODE, TEMPO_SOURCE, type BundleTempo } from '@kitbag/core-state';
import { afterEach, describe, expect, it } from 'vitest';

import {
  mountTracked,
  unmountTracked,
  type Player,
} from './playerHarness.test-helper.tsx';

const MENU = 'Player menu';
const FOLLOW_ROW = 'Tempo, Follow the band';
const CONSTANT_ROW = 'Tempo, Constant tempo';
const CONSTANT = 'Constant tempo';
const FOLLOW = 'Follow the band';
const BEAT_SECONDS = 0.5;
const FOLLOW_TEMPO: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: 128,
  anchor: 0,
  beatsPerBar: 4,
  source: TEMPO_SOURCE.detected,
};
const SONG = {
  beats: Array.from({ length: 16 }, (_, i) => i * BEAT_SECONDS),
  bars: [{ beat: 0, beatsPerBar: 4 }],
  tempo: FOLLOW_TEMPO,
};

let player: Player | undefined;

afterEach(() => {
  player?.store.getState().close();
  player = undefined;
  unmountTracked();
});

type SongChange = NonNullable<Parameters<typeof mountTracked>[0]>;

async function openMenu(change: SongChange = {}) {
  const p = await mountTracked({ ...SONG, ...change });
  player = p;
  await p.press(MENU);
  return p;
}

async function openTempoSheet(change: SongChange = {}, row = FOLLOW_ROW) {
  const p = await openMenu(change);
  await p.press(row);
  return p;
}

describe('the Tempo row in the Player sheet', () => {
  it('sits between Meter and Click grouping with the grid in use', async () => {
    const p = await openMenu();
    const texts = p.texts();
    const order = ['Meter', 'Tempo', 'Click grouping'];
    const at = order.map((text) => texts.indexOf(text));
    expect(at).not.toContain(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(p.byLabel(FOLLOW_ROW).props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('is disabled with the way out for a bundle without tempo', async () => {
    const p = await openMenu({ tempo: null });
    const row = p.byLabel('Tempo, Re-export from StemDeck to switch tempo.');
    expect(row.props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('the Tempo sheet', () => {
  it('shows the fitted tempo and what the grid in use does', async () => {
    const p = await openTempoSheet();
    expect(p.has('Constant: 128.0 BPM')).toBe(true);
    expect(
      p.has(
        'The beats StemDeck heard. The click and loop snapping speed up and slow down with the band.',
      ),
    ).toBe(true);
    expect(p.byLabel(FOLLOW).props.accessibilityState).toEqual({
      checked: true,
    });
  });

  it('switches and stores the grid at once', async () => {
    const p = await openTempoSheet();
    await p.press(CONSTANT);
    expect(p.records.saveStemSetChosenTempoMode).toHaveBeenLastCalledWith(
      7,
      TEMPO_MODE.constant,
    );
    expect(p.store.getState().tempoMode).toBe(TEMPO_MODE.constant);
    expect(
      p.has(
        'One tempo for the whole song. The click and loop snapping hold steady.',
      ),
    ).toBe(true);
    await p.press('Done');
    await p.press(MENU);
    expect(p.labelled(CONSTANT_ROW)).toHaveLength(1);
  });

  it('keeps Follow the band out of reach for a constant export', async () => {
    const p = await openTempoSheet(
      { tempo: { ...FOLLOW_TEMPO, mode: TEMPO_MODE.constant } },
      CONSTANT_ROW,
    );
    expect(p.byLabel(FOLLOW).props.accessibilityState).toEqual({
      checked: false,
      disabled: true,
    });
    expect(
      p.has(
        'Exported from StemDeck at a constant tempo. Export it in Follow the band to switch.',
      ),
    ).toBe(true);
    await p.press(FOLLOW);
    expect(p.store.getState().tempoMode).toBe(TEMPO_MODE.constant);
    expect(p.records.saveStemSetChosenTempoMode).not.toHaveBeenCalled();
  });

  it('keeps Constant tempo out of reach with the reason when StemDeck found no tempo', async () => {
    const p = await openTempoSheet({
      tempo: { ...FOLLOW_TEMPO, bpm: null, anchor: null },
    });
    expect(p.byLabel(CONSTANT).props.accessibilityState).toEqual({
      checked: false,
      disabled: true,
    });
    expect(p.has('StemDeck found no steady tempo in this song.')).toBe(true);
    expect(p.texts().some((text) => text.startsWith('Constant:'))).toBe(false);
  });
});
