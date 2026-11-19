import type { MoveStatus } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { DATA_FOLDER_CODES as CODES } from './dataFolderCodes.test-helper.ts';
import {
  CLOSED,
  dataFolderSheet,
  nextDataFolderStep,
  settledOutcome,
  sheetActions,
  type DataFolderEvent,
  type DataFolderSheet,
  type DataFolderStep,
} from './dataFolderFlow.ts';

const CARD = '1234-ABCD';

function move(fields: Partial<MoveStatus> = {}): MoveStatus {
  return {
    phase: 'COPYING',
    sourceVolumeUuid: null,
    targetVolumeUuid: CARD,
    doneBytes: 540,
    totalBytes: 1_200,
    doneFiles: 24,
    totalFiles: 54,
    path: null,
    running: true,
    switched: false,
    paused: false,
    awaitingRelease: false,
    error: null,
    ...fields,
  };
}

const RUNNING = move();
const SWITCHED = move({ phase: 'CLEANING', switched: true });
const AWAITING = move({
  phase: 'CLEANING',
  switched: true,
  running: false,
  awaitingRelease: true,
});
const PAUSED = move({ running: false, paused: true });
const STOPPED = move({
  running: false,
  paused: true,
  error: CODES.moveErrors.io,
});
const IDLE = { move: null, error: null };

const steps = (...events: DataFolderEvent[]) =>
  events.reduce<DataFolderStep>(nextDataFolderStep, CLOSED);

const ids = (sheet: DataFolderSheet, pending = false) =>
  sheetActions(sheet, pending).map((action) => action.id);

describe('choose → confirm → moving → done', () => {
  it('walks the sheets as the store moves', () => {
    const opened = steps({ kind: 'open' });
    expect(dataFolderSheet(IDLE, opened).kind).toBe('chooser');

    const confirming = nextDataFolderStep(opened, {
      kind: 'choose',
      target: CARD,
    });
    expect(dataFolderSheet(IDLE, confirming)).toEqual({
      kind: 'confirm',
      target: CARD,
    });
    expect(ids(dataFolderSheet(IDLE, confirming))).toEqual([
      'backToChooser',
      'move',
    ]);

    const moving = dataFolderSheet({ move: RUNNING, error: null }, confirming);
    expect(moving).toEqual({ kind: 'moving', move: RUNNING });

    const done = nextDataFolderStep(confirming, {
      kind: 'finished',
      settled: true,
    });
    expect(dataFolderSheet(IDLE, done).kind).toBe('none');
  });

  it('goes back to the chooser from the confirmation', () => {
    const back = steps(
      { kind: 'open' },
      { kind: 'choose', target: CARD },
      { kind: 'back' },
    );
    expect(dataFolderSheet(IDLE, back).kind).toBe('chooser');
  });

  it('shows nothing while closed, whatever the store holds', () => {
    expect(dataFolderSheet({ move: RUNNING, error: null }, CLOSED).kind).toBe(
      'none',
    );
  });
});

describe('cancel', () => {
  it('asks before stopping and closes once the move is cancelled', () => {
    const asking = steps({ kind: 'open' }, { kind: 'askStop' });
    const sheet = dataFolderSheet({ move: RUNNING, error: null }, asking);
    expect(sheet.kind).toBe('stopAsk');
    expect(ids(sheet)).toEqual(['stop', 'keepMoving']);
    const cancelled = nextDataFolderStep(asking, {
      kind: 'finished',
      settled: settledOutcome(
        { outcome: CODES.moveOutcomes.cancelled, error: null, path: null },
        CODES.moveOutcomes,
      ),
    });
    expect(cancelled).toBe(CLOSED);
  });

  it('keeps moving from the question', () => {
    const kept = steps(
      { kind: 'open' },
      { kind: 'askStop' },
      {
        kind: 'keepMoving',
      },
    );
    expect(dataFolderSheet({ move: RUNNING, error: null }, kept).kind).toBe(
      'moving',
    );
  });

  it('offers Cancel only before the switch', () => {
    const opened = steps({ kind: 'open' });
    const before = dataFolderSheet({ move: RUNNING, error: null }, opened);
    expect(ids(before)).toEqual(['askStop']);
    for (const after of [SWITCHED, AWAITING]) {
      const sheet = dataFolderSheet({ move: after, error: null }, opened);
      expect(sheet.kind).toBe('moving');
      expect(ids(sheet)).toEqual([]);
    }
  });

  it('never asks to stop once the folder switched', () => {
    const asking = steps({ kind: 'open' }, { kind: 'askStop' });
    expect(dataFolderSheet({ move: SWITCHED, error: null }, asking).kind).toBe(
      'moving',
    );
  });
});

describe('paused and failed moves', () => {
  it('offers Resume and Undo for a move the app was killed in', () => {
    const sheet = dataFolderSheet(
      { move: PAUSED, error: null },
      steps({
        kind: 'open',
      }),
    );
    expect(sheet).toEqual({ kind: 'paused', move: PAUSED, error: null });
    expect(ids(sheet)).toEqual(['undo', 'resume']);
  });

  it('keeps a move stopped by a failure resumable, with its error', () => {
    const sheet = dataFolderSheet(
      { move: STOPPED, error: null },
      steps({
        kind: 'open',
      }),
    );
    expect(sheet).toEqual({
      kind: 'paused',
      move: STOPPED,
      error: CODES.moveErrors.io,
    });
  });

  it('shows the refusal of the last request over the journal’s error', () => {
    const refused = CODES.moveErrors.foregroundRefused;
    const sheet = dataFolderSheet(
      { move: STOPPED, error: refused },
      steps({
        kind: 'open',
      }),
    );
    expect(sheet).toMatchObject({ kind: 'paused', error: refused });
  });

  it('shows a failure with nothing left to resume, and goes back to choose', () => {
    const failed = CODES.moveErrors.targetNotWritable;
    const opened = steps({ kind: 'open' }, { kind: 'choose', target: CARD });
    const sheet = dataFolderSheet({ move: null, error: failed }, opened);
    expect(sheet).toEqual({ kind: 'failed', error: failed });
    expect(ids(sheet)).toEqual(['ok', 'chooseAnother']);
    const again = nextDataFolderStep(opened, { kind: 'acted' });
    expect(dataFolderSheet(IDLE, again).kind).toBe('chooser');
  });

  it('keeps the sheet open when a move finishes failed', () => {
    const settled = settledOutcome(
      { outcome: CODES.moveOutcomes.failed, error: 'x', path: null },
      CODES.moveOutcomes,
    );
    expect(settled).toBe(false);
    const opened = steps({ kind: 'open' });
    expect(nextDataFolderStep(opened, { kind: 'finished', settled })).toEqual({
      kind: 'open',
    });
    expect(nextDataFolderStep(CLOSED, { kind: 'finished', settled })).toBe(
      CLOSED,
    );
  });
});

describe('pending requests', () => {
  const sheets: readonly DataFolderSheet[] = [
    { kind: 'confirm', target: CARD },
    { kind: 'moving', move: RUNNING },
    { kind: 'stopAsk', move: RUNNING },
    { kind: 'paused', move: PAUSED, error: null },
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
