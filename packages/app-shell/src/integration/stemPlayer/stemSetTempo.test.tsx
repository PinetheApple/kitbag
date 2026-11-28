// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { SET_TEMPO_COPY } from '@kitbag/core-design';
import { MANUAL_TEMPO_LABEL, stemPlayerStore } from '@kitbag/core-state';
import { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { NO_GRID_REASON, UNDO } from '@kitbag/tool-stems/src/logic/meterEdit.ts';
import { SET_TEMPO_UNLOCKS } from '@kitbag/tool-stems/src/logic/setTempoView.ts';
import {
  at,
  flush,
  mountTracked,
  SET_ID,
  type Player,
} from './playerHarness.test-helper.tsx';

const NO_GRID = { beats: [], bars: [], bpm: null, key: 'F', scale: 'major' };
const MANUAL = { bpm: 128, anchor: 0.8, beatsPerBar: 4 } as const;
const NO_CLICK = 'no click';
const SET_TEMPO_ROW = `${SET_TEMPO_COPY.title}, ${SET_TEMPO_UNLOCKS}`;
const PREVIEW = SET_TEMPO_COPY.previewClick;
const PLAYHEAD_SEC = 0.8;

function pressNode(node: ReactTestInstance | undefined) {
  let step = node ?? null;
  while (step !== null && typeof step.props.onPress !== 'function')
    step = step.parent;
  if (step === null) throw new Error('nothing pressable');
  const target = step;
  act(() => {
    (target.props.onPress as () => void)();
  });
}

function typeDigits(p: Player, digits: string) {
  for (const digit of digits) pressNode(p.textNode(digit));
}

async function toStepTwo(p: Player) {
  await p.press(SET_TEMPO_COPY.title);
  typeDigits(p, '128');
  p.engine.position = at(PLAYHEAD_SEC);
  await p.press(SET_TEMPO_COPY.next);
  await flush();
}

async function saved(p: Player) {
  await p.press(SET_TEMPO_COPY.save);
  await flush();
}

describe('a stem song with no grid', () => {
  it('shows Set tempo where the BPM chip would be, and no click in place of the tempo fact', async () => {
    const p = await mountTracked(NO_GRID);
    const button = p.byLabel(SET_TEMPO_COPY.title);
    expect(p.has('BPM')).toBe(false);
    expect(p.has(NO_CLICK)).toBe(true);
    const texts = p.texts();
    expect(texts.indexOf(SET_TEMPO_COPY.title)).toBeLessThan(
      texts.indexOf('F maj'),
    );
    expect(button.props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('lists Set tempo in the Player sheet and says Meter needs a grid', async () => {
    const p = await mountTracked(NO_GRID);
    await p.press('Player menu');
    expect(p.labelled(SET_TEMPO_ROW)).toHaveLength(1);
    expect(p.has(NO_GRID_REASON)).toBe(true);
    expect(NO_GRID_REASON).toBe('Needs a beat grid.');
  });

  it('opens the sheet from the Player sheet row', async () => {
    const p = await mountTracked(NO_GRID);
    await p.press('Player menu');
    await p.press(SET_TEMPO_ROW);
    expect(p.has(SET_TEMPO_COPY.stepOne)).toBe(true);
  });

  it('saves a typed tempo with bar 1 at the playhead, then shows it with Undo', async () => {
    const p = await mountTracked(NO_GRID);
    await toStepTwo(p);
    expect(p.has(SET_TEMPO_COPY.stepTwo)).toBe(true);
    await saved(p);
    expect(p.records.saveStemSetManualTempo).toHaveBeenCalledWith(SET_ID, {
      manualTempo: MANUAL,
      meterOverride: { meterBeatsPerBar: null, barOneSeconds: null },
    });
    expect(p.has('Tempo set: 128 BPM, bar 1 at 0:00.8.')).toBe(true);
    expect(p.has('128')).toBe(true);
    expect(p.has(MANUAL_TEMPO_LABEL)).toBe(true);
    expect(p.labelled(SET_TEMPO_COPY.title)).toHaveLength(0);
    expect(p.store.getState().click).toBe(true);
  });

  it('undoes back to no grid', async () => {
    const p = await mountTracked(NO_GRID);
    await toStepTwo(p);
    await saved(p);
    await p.press(UNDO);
    await flush();
    expect(p.store.getState()).toMatchObject({
      manualTempo: null,
      beats: [],
      click: false,
    });
    expect(p.labelled(SET_TEMPO_COPY.title)).toHaveLength(1);
  });

  it('previews the draft grid and the click in step 2 without storing it', async () => {
    const p = await mountTracked(NO_GRID);
    await toStepTwo(p);
    const { tempoPreview, click, beats } = p.store.getState();
    expect({ tempoPreview, click }).toEqual({
      tempoPreview: { savedGrid: false },
      click: true,
    });
    expect(beats.length).toBeGreaterThan(0);
    expect(p.labelled(SET_TEMPO_COPY.title)).toHaveLength(1);
    expect(p.records.saveStemSetManualTempo).not.toHaveBeenCalled();
  });

  it('drops the preview and the click it started when the sheet closes', async () => {
    const p = await mountTracked(NO_GRID);
    await toStepTwo(p);
    await p.press(SET_TEMPO_COPY.close);
    await flush();
    expect(p.store.getState()).toMatchObject({
      tempoPreview: null,
      click: false,
      beats: [],
    });
  });

  it('keeps the click off after Save when the Preview click chip turned it off', async () => {
    const p = await mountTracked(NO_GRID);
    await toStepTwo(p);
    await p.press(PREVIEW);
    await flush();
    expect(p.store.getState().click).toBe(false);
    await saved(p);
    expect(p.store.getState()).toMatchObject({
      click: false,
      manualTempo: MANUAL,
    });
  });
});

describe('moving to another stem song', () => {
  it('closes the Set tempo sheet and drops its preview', async () => {
    const p = await mountTracked(NO_GRID);
    await toStepTwo(p);
    await p.showSet(SET_ID + 1);
    await flush();
    expect(p.has(SET_TEMPO_COPY.stepTwo)).toBe(false);
    expect(p.store.getState()).toMatchObject({
      setId: SET_ID + 1,
      tempoPreview: null,
      click: false,
    });
  });
});

describe('a stem song with its own grid', () => {
  it('offers no Set tempo until #384', async () => {
    const p = await mountTracked();
    expect(p.labelled(SET_TEMPO_COPY.title)).toHaveLength(0);
    await p.press('Player menu');
    expect(p.labelled(SET_TEMPO_ROW)).toHaveLength(0);
    expect(p.has(SET_TEMPO_COPY.tempoDetail)).toBe(false);
  });

  it('keeps a manual tempo it came back with editable from the Player sheet', async () => {
    const p = await mountTracked({ manualTempo: MANUAL });
    expect(stemPlayerStore.getState().beats.length).toBeGreaterThan(0);
    await p.press('Player menu');
    const row = p.byLabel(
      `${SET_TEMPO_COPY.tempo}, 128 BPM, ${SET_TEMPO_COPY.tempoDetail}`,
    );
    pressNode(row);
    await flush();
    expect(p.has(SET_TEMPO_COPY.stepOne)).toBe(true);
    expect(p.has('128')).toBe(true);
  });
});
