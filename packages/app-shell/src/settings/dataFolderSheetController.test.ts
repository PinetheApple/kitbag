import { DATA_FOLDER_CODES as CODES } from '@kitbag/core-state/src/dataFolder/codes.test-helper.ts';
import { describe, expect, it, vi } from 'vitest';

import { CARD, move } from './dataFolderMove.test-helper.ts';
import {
  finished,
  gate,
  ON_CARD,
  RUNNING,
  setup,
} from './dataFolderSheetController.test-helper.ts';

describe('stop moving', () => {
  it('stays closed when the cancel finishes before the request resolves', async () => {
    const { native, controller, notices, sheet, emit, settle } =
      await setup(RUNNING);
    const held = gate();
    native.cancelMove.mockReturnValue(held.promise);
    controller.open();
    controller.act.askStop();
    controller.act.stop();
    emit.finished(finished(CODES.moveOutcomes.cancelled));
    expect(sheet()).toBe('none');
    held.open();
    await settle();
    await vi.waitFor(() => {
      expect(controller.step().kind).toBe('closed');
    });
    expect(sheet()).toBe('none');
    expect(notices).toEqual([
      'Move stopped. Your files are still on internal storage.',
    ]);
  });

  it('closes when the request resolves before the cancel finishes', async () => {
    const { controller, sheet, emit, settle } = await setup(RUNNING);
    controller.open();
    controller.act.askStop();
    controller.act.stop();
    await settle();
    expect(sheet()).toBe('moving');
    emit.finished(finished(CODES.moveOutcomes.cancelled));
    expect(sheet()).toBe('none');
  });
});

describe('a stale error', () => {
  it('is gone after a successful finish, so reopening shows the chooser', async () => {
    const { store, native, controller, sheet, emit, settle } = await setup();
    native.startMove.mockRejectedValueOnce(
      Object.assign(new Error('refused'), {
        code: CODES.moveErrors.foregroundRefused,
      }),
    );
    controller.open();
    controller.choose(CARD);
    controller.act.move();
    await settle();
    expect(sheet()).toBe('failed');
    emit.finished(finished(CODES.moveOutcomes.done));
    expect(store.getState().error).toBeNull();
    controller.open();
    expect(sheet()).toBe('chooser');
  });

  it('is cleared when a failed sheet is closed', async () => {
    const { store, native, controller, settle } = await setup();
    native.undoMove.mockRejectedValueOnce(
      Object.assign(new Error('refused'), { code: CODES.moveErrors.noMove }),
    );
    await store.getState().undoMove();
    await settle();
    controller.open();
    controller.close();
    expect(store.getState().error).toBeNull();
  });
});

describe('the outcome names the move’s target', () => {
  it('says the card when done arrives before the volumes are reread', async () => {
    const { native, controller, notices, emit } = await setup();
    controller.open();
    controller.choose(CARD);
    controller.act.move();
    emit.progress(RUNNING);
    native.listVolumes.mockResolvedValue(ON_CARD);
    emit.finished(finished(CODES.moveOutcomes.done));
    expect(notices).toEqual(['Move finished. Your files are on the SD card.']);
  });

  it('says the card when the move finished before its first progress', async () => {
    const { controller, notices, emit } = await setup();
    controller.open();
    controller.choose(CARD);
    controller.act.move();
    emit.finished(finished(CODES.moveOutcomes.done));
    expect(notices).toEqual(['Move finished. Your files are on the SD card.']);
  });
});

describe('starting a move', () => {
  it('holds the confirmation until the first progress, ignoring a second tap', async () => {
    const { native, controller, sheet, emit, settle } = await setup();
    controller.open();
    controller.choose(CARD);
    controller.act.move();
    await settle();
    expect(controller.step().kind).toBe('starting');
    expect(sheet()).toBe('confirm');
    controller.act.move();
    expect(native.startMove).toHaveBeenCalledOnce();
    emit.progress(RUNNING);
    expect(controller.step().kind).toBe('open');
    expect(sheet()).toBe('moving');
  });
});

describe('undo', () => {
  const PAUSED = move({ running: false, paused: true });

  it('says undone only when the undo ran', async () => {
    const { store, controller, notices, settle, status } = await setup(PAUSED);
    controller.open();
    status.current = null;
    controller.act.undo();
    await settle();
    await vi.waitFor(() => {
      expect(notices).toEqual([
        'Move undone. Your files are still on internal storage.',
      ]);
    });
    expect(store.getState().move).toBeNull();
    expect(controller.step().kind).toBe('closed');
  });

  it('says nothing when a pending request dropped it', async () => {
    const { native, controller, notices, settle } = await setup(PAUSED);
    const held = gate();
    native.resumeMove.mockReturnValue(held.promise);
    controller.open();
    controller.act.resume();
    controller.act.undo();
    held.open();
    await settle();
    expect(native.undoMove).not.toHaveBeenCalled();
    expect(notices).toEqual([]);
  });
});

describe('a move a failure stopped', () => {
  it('closes on Not now and keeps the journal, with Undo still reachable', async () => {
    const stopped = move({
      running: false,
      paused: true,
      error: CODES.moveErrors.hashMismatch,
    });
    const { store, native, controller, sheet, emit } = await setup(stopped);
    controller.open();
    emit.finished(
      finished(CODES.moveOutcomes.failed, CODES.moveErrors.hashMismatch),
      stopped,
    );
    expect(sheet()).toBe('stopped');
    controller.act.notNow();
    expect(sheet()).toBe('none');
    expect(native.undoMove).not.toHaveBeenCalled();
    expect(store.getState().move).toBe(stopped);
    controller.open();
    expect(sheet()).toBe('paused');
  });
});

describe('places known before any event', () => {
  it('names the target of a move already in the store when it finishes', async () => {
    const awaiting = move({
      phase: 'CLEANING',
      switched: true,
      running: false,
      awaitingRelease: true,
    });
    const { notices, emit } = await setup(awaiting);
    emit.finished(finished(CODES.moveOutcomes.done));
    expect(notices).toEqual(['Move finished. Your files are on the SD card.']);
  });
});

describe('a start that is refused', () => {
  it('leaves starting when the request is rejected', async () => {
    const { native, controller, sheet, settle } = await setup();
    native.startMove.mockRejectedValueOnce(
      Object.assign(new Error('refused'), {
        code: CODES.moveErrors.targetLeftovers,
      }),
    );
    controller.open();
    controller.choose(CARD);
    controller.act.move();
    await settle();
    await vi.waitFor(() => {
      expect(controller.step().kind).toBe('open');
    });
    expect(sheet()).toBe('failed');
    controller.act.chooseAnother();
    expect(sheet()).toBe('chooser');
  });

  it('leaves starting when the service reports a refusal', async () => {
    const { controller, sheet, emit, settle } = await setup();
    controller.open();
    controller.choose(CARD);
    controller.act.move();
    await settle();
    expect(controller.step().kind).toBe('starting');
    emit.finished(
      finished(CODES.moveOutcomes.refused, CODES.moveErrors.inProgress),
    );
    expect(controller.step().kind).toBe('open');
    expect(sheet()).toBe('failed');
  });
});

describe('old copies left after the switch', () => {
  it('resumes the clean-up on Try again', async () => {
    const left = move({
      phase: 'CLEANING',
      switched: true,
      running: false,
      error: CODES.moveErrors.io,
    });
    const { native, controller, sheet, settle } = await setup(left);
    controller.open();
    expect(sheet()).toBe('switchedFailed');
    controller.act.resume();
    await settle();
    expect(native.resumeMove).toHaveBeenCalledOnce();
  });
});
