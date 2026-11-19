import {
  detectedHint,
  meterCopy,
  meterLabel,
  meterRowValue,
} from '@kitbag/core-design';
import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-state';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NO_GRID_REASON, NOT_SAVED } from '../logic/meterEdit.ts';
import {
  at,
  flush,
  mountTracked,
  SONG_DETAILS,
  type Player,
} from './playerHarness.test-helper.tsx';

type Node = ReturnType<Player['byText']>;

const FOUR_FOUR = [{ beat: 0, beatsPerBar: GRID_METER.quadruple }];
const SONG = { ...SONG_DETAILS, bars: FOUR_FOUR };
const SET_ID = 7;
const PLAYHEAD = 1.1;
const NEAREST_BEAT = 1;
const MOVED = { ...NO_METER_OVERRIDE, barOneSeconds: NEAREST_BEAT };
const TRIPLE = { ...NO_METER_OVERRIDE, meterBeatsPerBar: GRID_METER.triple };
const SIX = 6;
const SIX_FOUR = [{ beat: 0, beatsPerBar: SIX }];
const TRIPLE_LABEL = meterLabel(GRID_METER.triple);
const QUADRUPLE_LABEL = meterLabel(GRID_METER.quadruple);
const MOVED_BAR_THREE = {
  meterBeatsPerBar: GRID_METER.triple,
  barOneSeconds: 1,
};
const TRIPLE_NOTICE = 'Meter set to 3/4. Saved for this song.';
const MOVED_NOTICE = 'Bar 1 moved to 0:01.0. Saved for this song.';

type ReaderState = 'disabled' | 'checked';

function readerState(node: Node, key: ReaderState): boolean {
  for (let step: Node | null = node; step; step = step.parent) {
    const state = step.props.accessibilityState as
      Partial<Record<ReaderState, boolean>> | undefined;
    if (state?.[key] === true) return true;
  }
  return false;
}

const readerDisabled = (node: Node) => readerState(node, 'disabled');

function pressable(node: Node): Node {
  for (let step: Node | null = node; step; step = step.parent)
    if (typeof step.props.onPress === 'function') return step;
  throw new Error('no pressable around this text');
}

async function pressText(p: Player, text: string) {
  act(() => {
    (pressable(p.byText(text)).props.onPress as () => void)();
  });
  await flush();
}

function holdSave(p: Player) {
  let settle: (error?: Error) => void = () => undefined;
  p.records.saveStemSetMeterOverride.mockReturnValueOnce(
    new Promise<void>((resolve, reject) => {
      settle = (error) => {
        if (error === undefined) resolve();
        else reject(error);
      };
    }),
  );
  return async (error?: Error) => {
    settle(error);
    await flush();
  };
}

async function reopen(p: Player) {
  await p.press('Player menu');
  await pressText(p, meterCopy.title);
}

async function meterSheet(change: Parameters<typeof mountTracked>[0] = SONG) {
  const p = await mountTracked(change);
  await reopen(p);
  return p;
}

describe('the Meter row', () => {
  it('sits under Reset mix and shows the detected meter', async () => {
    const p = await mountTracked(SONG);
    await p.press('Player menu');
    const texts = p.texts();
    expect(texts.indexOf(meterCopy.title)).toBeGreaterThan(
      texts.indexOf('Reset mix'),
    );
    expect(p.has(QUADRUPLE_LABEL)).toBe(true);
  });

  it('marks an override as yours', async () => {
    const p = await mountTracked({
      ...SONG,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await p.press('Player menu');
    expect(p.has(meterRowValue(GRID_METER.triple, true))).toBe(true);
  });

  it('is disabled for a stem song with no beat grid', async () => {
    const p = await mountTracked({ ...SONG, beats: [], bars: [] });
    await p.press('Player menu');
    expect(readerDisabled(p.byText(meterCopy.title))).toBe(true);
    expect(p.has(NO_GRID_REASON)).toBe(true);
  });

  it('is enabled with a beat grid', async () => {
    const p = await mountTracked(SONG);
    await p.press('Player menu');
    expect(readerDisabled(p.byText(meterCopy.title))).toBe(false);
    expect(p.has(NO_GRID_REASON)).toBe(false);
  });

  it('shows a detected meter the picker does not offer', async () => {
    const p = await mountTracked({ ...SONG, bars: SIX_FOUR });
    await p.press('Player menu');
    expect(p.has(meterLabel(SIX))).toBe(true);
  });

  it('opens the Meter sheet in place of the Player menu', async () => {
    const p = await meterSheet();
    expect(p.has('Reset mix')).toBe(false);
    expect(p.has(detectedHint(GRID_METER.quadruple, 0, false))).toBe(true);
  });
});

describe('editing the meter', () => {
  it('takes the beat nearest the playhead as bar 1, saves and applies it', async () => {
    const p = await meterSheet();
    p.engine.position = at(PLAYHEAD);
    await pressText(p, meterCopy.barOneHere);
    expect(p.records.saveStemSetMeterOverride).toHaveBeenCalledWith(
      SET_ID,
      MOVED,
    );
    expect(p.store.getState().meterOverride).toEqual(MOVED);
    expect(p.has(MOVED_NOTICE)).toBe(true);
  });

  it('takes bar 1 from the engine head, not the drawn playhead', async () => {
    const p = await meterSheet();
    p.frames(0);
    p.engine.position = at(PLAYHEAD);
    await pressText(p, meterCopy.barOneHere);
    expect(p.store.getState().meterOverride).toEqual(MOVED);
  });

  it('puts the old bars back on Undo', async () => {
    const p = await meterSheet();
    p.engine.position = at(PLAYHEAD);
    const before = p.store.getState().downbeatIndices;
    await pressText(p, meterCopy.barOneHere);
    await p.press('Undo');
    expect(p.records.saveStemSetMeterOverride).toHaveBeenLastCalledWith(
      SET_ID,
      NO_METER_OVERRIDE,
    );
    expect(p.store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(p.store.getState().downbeatIndices).toEqual(before);
    expect(p.has(MOVED_NOTICE)).toBe(false);
  });

  it('regroups the bars when another meter is picked', async () => {
    const p = await meterSheet();
    await pressText(p, TRIPLE_LABEL);
    expect(p.records.saveStemSetMeterOverride).toHaveBeenCalledWith(
      SET_ID,
      TRIPLE,
    );
    expect(p.store.getState().downbeatIndices).toEqual([0, 3, 6]);
  });

  it('keeps the bars and says so when the save fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await meterSheet();
    p.records.saveStemSetMeterOverride.mockRejectedValueOnce(new Error('disk'));
    await pressText(p, TRIPLE_LABEL);
    await flush();
    expect(p.store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(p.has(NOT_SAVED)).toBe(true);
    expect(p.labelled('Undo')).toHaveLength(0);
    await p.press('Try again');
    expect(p.store.getState().meterOverride).toEqual(TRIPLE);
    expect(p.has(NOT_SAVED)).toBe(false);
    expect(p.has(TRIPLE_NOTICE)).toBe(true);
    await p.press('Undo');
    expect(p.store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    warn.mockRestore();
  });

  it('keeps both of two quick edits', async () => {
    const p = await meterSheet();
    p.engine.position = at(PLAYHEAD);
    const release = holdSave(p);
    await pressText(p, TRIPLE_LABEL);
    await pressText(p, meterCopy.barOneHere);
    await release();
    expect(p.records.saveStemSetMeterOverride).toHaveBeenLastCalledWith(
      SET_ID,
      MOVED_BAR_THREE,
    );
    expect(p.store.getState().meterOverride).toEqual(MOVED_BAR_THREE);
  });

  it('drops a notice that lands after Done', async () => {
    const p = await meterSheet();
    const release = holdSave(p);
    await pressText(p, TRIPLE_LABEL);
    await pressText(p, meterCopy.done);
    await release();
    expect(p.store.getState().meterOverride).toEqual(TRIPLE);
    await reopen(p);
    expect(p.has(TRIPLE_NOTICE)).toBe(false);
    expect(p.labelled('Undo')).toHaveLength(0);
  });

  it('drops a failure that lands after Done', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await meterSheet();
    const release = holdSave(p);
    await pressText(p, TRIPLE_LABEL);
    await pressText(p, meterCopy.done);
    await release(new Error('disk'));
    await reopen(p);
    expect(p.store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(p.has(NOT_SAVED)).toBe(false);
    warn.mockRestore();
  });

  it('overrides a detected meter the picker does not offer', async () => {
    const p = await meterSheet({ ...SONG, bars: SIX_FOUR });
    expect(readerState(p.byText(TRIPLE_LABEL), 'checked')).toBe(false);
    expect(readerState(p.byText(QUADRUPLE_LABEL), 'checked')).toBe(false);
    await pressText(p, TRIPLE_LABEL);
    expect(p.store.getState().meterOverride).toEqual(TRIPLE);
    expect(readerState(p.byText(TRIPLE_LABEL), 'checked')).toBe(true);
  });

  it('does not re-render while the playhead moves under the sheet', async () => {
    const p = await meterSheet();
    p.frames(PLAYHEAD);
    p.commit.mockClear();
    p.frames(PLAYHEAD, 3);
    p.frames(PLAYHEAD * 2, 3);
    expect(p.commit).not.toHaveBeenCalled();
  });
});
