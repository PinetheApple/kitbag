import { DATA_FOLDER_CODES as CODES } from '@kitbag/core-state/src/dataFolder/codes.test-helper.ts';
import { describe, expect, it } from 'vitest';

import {
  CLOSED,
  dataFolderSheet,
  nextDataFolderStep,
  sheetActions,
  type DataFolderEvent,
  type DataFolderSheet,
  type DataFolderStep,
} from './dataFolderFlow.ts';
import { CARD, move } from './dataFolderMove.test-helper.ts';

const RUNNING = move();
const CLEANING = move({ phase: 'CLEANING', switched: true });
const AWAITING = move({
  phase: 'CLEANING',
  switched: true,
  running: false,
  awaitingRelease: true,
});
const CLEANUP_FAILED = move({
  phase: 'CLEANING',
  switched: true,
  running: false,
  error: CODES.moveErrors.io,
});
const PAUSED = move({ running: false, paused: true });
const STOPPED = move({
  running: false,
  paused: true,
  error: CODES.moveErrors.hashMismatch,
});

const steps = (...events: DataFolderEvent[]) =>
  events.reduce<DataFolderStep>(nextDataFolderStep, CLOSED);

const OPENED = steps({ kind: 'open' });

const ids = (sheet: DataFolderSheet, pending = false) =>
  sheetActions(sheet, pending).map((action) => action.id);

const sheetOf = (
  moving: typeof RUNNING | null,
  step: DataFolderStep = OPENED,
  error: string | null = null,
) => dataFolderSheet({ move: moving, error }, step);

describe('choose → confirm → starting → moving', () => {
  it('walks the sheets as the store moves', () => {
    expect(sheetOf(null).kind).toBe('chooser');
    const confirming = nextDataFolderStep(OPENED, {
      kind: 'choose',
      target: CARD,
    });
    const confirm = sheetOf(null, confirming);
    expect(confirm).toEqual({ kind: 'confirm', target: CARD, starting: false });
    expect(ids(confirm)).toEqual(['backToChooser', 'move']);
    expect(sheetOf(RUNNING, confirming)).toEqual({
      kind: 'moving',
      move: RUNNING,
    });
  });

  it('holds a started move on a disabled confirmation until it shows up', () => {
    const starting = steps(
      { kind: 'open' },
      { kind: 'choose', target: CARD },
      { kind: 'start' },
    );
    const sheet = sheetOf(null, starting);
    expect(sheet).toEqual({ kind: 'confirm', target: CARD, starting: true });
    expect(sheetActions(sheet, false).every((a) => a.disabled)).toBe(true);
    expect(nextDataFolderStep(starting, { kind: 'start' })).toBe(starting);
    expect(nextDataFolderStep(starting, { kind: 'progressed' })).toEqual({
      kind: 'open',
    });
  });

  it('goes back to the chooser from the confirmation', () => {
    const back = steps(
      { kind: 'open' },
      { kind: 'choose', target: CARD },
      { kind: 'back' },
    );
    expect(sheetOf(null, back).kind).toBe('chooser');
  });

  it('shows nothing while closed, whatever the store holds', () => {
    expect(sheetOf(RUNNING, CLOSED).kind).toBe('none');
  });
});

describe('closed stays closed', () => {
  const late: readonly DataFolderEvent[] = [
    { kind: 'requestSettled' },
    { kind: 'progressed' },
    { kind: 'back' },
    { kind: 'keepMoving' },
    { kind: 'askStop' },
    { kind: 'start' },
    { kind: 'finished', settled: false },
  ];

  it('ignores every event but open once the sheet closed', () => {
    for (const event of late) {
      expect(nextDataFolderStep(CLOSED, event)).toBe(CLOSED);
    }
  });
});

describe('cancel', () => {
  it('asks before stopping', () => {
    const asking = steps({ kind: 'open' }, { kind: 'askStop' });
    const sheet = sheetOf(RUNNING, asking);
    expect(sheet.kind).toBe('stopAsk');
    expect(ids(sheet)).toEqual(['stop', 'keepMoving']);
    const kept = nextDataFolderStep(asking, { kind: 'keepMoving' });
    expect(sheetOf(RUNNING, kept).kind).toBe('moving');
  });

  it('offers Cancel only before the switch', () => {
    expect(ids(sheetOf(RUNNING))).toEqual(['askStop']);
    for (const after of [CLEANING, AWAITING]) {
      const sheet = sheetOf(after);
      expect(sheet.kind).toBe('switched');
      expect(ids(sheet)).toEqual([]);
    }
  });

  it('never asks to stop once the folder switched', () => {
    const asking = steps({ kind: 'open' }, { kind: 'askStop' });
    expect(sheetOf(CLEANING, asking).kind).toBe('switched');
  });
});

describe('after the switch', () => {
  it('shows the switched sheet whatever error a request left', () => {
    expect(sheetOf(AWAITING, OPENED, CODES.moveErrors.switched).kind).toBe(
      'switched',
    );
  });

  it('offers OK or Try again when clean-up failed', () => {
    const sheet = sheetOf(CLEANUP_FAILED);
    expect(sheet).toEqual({ kind: 'switchedFailed', move: CLEANUP_FAILED });
    expect(ids(sheet)).toEqual(['ok', 'resume']);
  });
});

describe('paused and failed moves', () => {
  it('offers Undo and Resume for a move the app was killed in', () => {
    const sheet = sheetOf(PAUSED);
    expect(sheet).toEqual({ kind: 'paused', move: PAUSED });
    expect(ids(sheet)).toEqual(['undo', 'resume']);
  });

  it('offers Not now and Try again for a move a failure stopped', () => {
    const sheet = sheetOf(STOPPED, OPENED, CODES.moveErrors.hashMismatch);
    expect(sheet).toEqual({
      kind: 'stopped',
      move: STOPPED,
      error: CODES.moveErrors.hashMismatch,
    });
    expect(ids(sheet)).toEqual(['notNow', 'resume']);
  });

  it('offers Undo and Resume once the failure was dismissed', () => {
    expect(ids(sheetOf(STOPPED))).toEqual(['undo', 'resume']);
  });

  it('shows the refusal of the last request over the journal’s error', () => {
    const refused = CODES.moveErrors.foregroundRefused;
    expect(sheetOf(STOPPED, OPENED, refused)).toMatchObject({
      kind: 'stopped',
      error: refused,
    });
  });

  it('shows a failure with nothing to resume, and goes back to choose', () => {
    const failed = CODES.moveErrors.targetNotWritable;
    const sheet = sheetOf(null, OPENED, failed);
    expect(sheet).toEqual({ kind: 'failed', error: failed });
    expect(ids(sheet)).toEqual(['ok', 'chooseAnother']);
    const again = nextDataFolderStep(OPENED, { kind: 'back' });
    expect(sheetOf(null, again).kind).toBe('chooser');
  });

  it('stays open when a move finishes failed and closes when it settles', () => {
    expect(
      nextDataFolderStep(OPENED, { kind: 'finished', settled: false }),
    ).toEqual({ kind: 'open' });
    expect(
      nextDataFolderStep(OPENED, { kind: 'finished', settled: true }),
    ).toBe(CLOSED);
  });
});

describe('pending requests', () => {
  const sheets: readonly DataFolderSheet[] = [
    { kind: 'confirm', target: CARD, starting: false },
    { kind: 'moving', move: RUNNING },
    { kind: 'stopAsk', move: RUNNING },
    { kind: 'switchedFailed', move: CLEANUP_FAILED },
    { kind: 'paused', move: PAUSED },
    { kind: 'stopped', move: STOPPED, error: CODES.moveErrors.io },
    { kind: 'failed', error: CODES.moveErrors.io },
  ];

  it('disables every button while a request is pending', () => {
    for (const sheet of sheets) {
      const actions = sheetActions(sheet, true);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((action) => action.disabled)).toBe(true);
    }
  });

  it('enables them again once it settles', () => {
    for (const sheet of sheets) {
      expect(sheetActions(sheet, false).some((a) => a.disabled)).toBe(false);
    }
  });
});
