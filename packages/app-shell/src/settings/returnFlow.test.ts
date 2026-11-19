import type { DataFolderVolume } from '@kitbag/core-native';
import { DATA_FOLDER_CODES as CODES } from '@kitbag/core-state/src/dataFolder/codes.test-helper.ts';
import { describe, expect, it } from 'vitest';

import {
  dataFolderSheet,
  nextDataFolderStep,
  sheetActions,
} from './dataFolderFlow.ts';
import { CARD, move } from './dataFolderMove.test-helper.ts';
import { createDataFolderSheetController } from './dataFolderSheetController.ts';
import {
  finished,
  ON_PHONE,
  setup,
} from './dataFolderSheetController.test-helper.ts';

const INTERNAL: DataFolderVolume = {
  volumeUuid: null,
  name: null,
  state: CODES.volumeStates.mounted,
  inUse: true,
  freeBytes: 5_000,
  totalBytes: 9_000,
  awayFiles: 0,
  awayBytes: 0,
  awayRequiredBytes: 0,
  awaySongs: 0,
  awayStemSongs: 0,
};

const RETURNED: DataFolderVolume = {
  ...INTERNAL,
  volumeUuid: CARD,
  name: 'SanDisk SD card',
  inUse: false,
  awayFiles: 6,
  awayBytes: 1_200,
  awayRequiredBytes: 1_300,
  awaySongs: 2,
  awayStemSongs: 1,
};

const WITH_CARD = { ...ON_PHONE, volumes: [INTERNAL, RETURNED] };

const RETURNING = move({
  sourceVolumeUuid: CARD,
  targetVolumeUuid: null,
  cardReturn: true,
});

async function offered() {
  const harness = await setup();
  harness.native.listVolumes.mockResolvedValue(WITH_CARD);
  await harness.store.getState().refreshVolumes();
  harness.controller.offerReturn(CARD);
  return harness;
}

describe('the returned card offer', () => {
  it('offers Not now and Move for the card', () => {
    const step = nextDataFolderStep(
      { kind: 'closed' },
      { kind: 'offerReturn', volumeUuid: CARD },
    );
    const sheet = dataFolderSheet(
      { move: null, error: null, volumes: WITH_CARD },
      step,
    );
    expect(sheet).toEqual({
      kind: 'returnOffer',
      volume: RETURNED,
      starting: false,
    });
    expect(sheetActions(sheet, false).map((action) => action.id)).toEqual([
      'declineReturn',
      'returnMove',
    ]);
  });

  it('shows nothing once the card has gone', () => {
    const step = nextDataFolderStep(
      { kind: 'closed' },
      { kind: 'offerReturn', volumeUuid: CARD },
    );
    const sheet = dataFolderSheet(
      { move: null, error: null, volumes: ON_PHONE },
      step,
    );
    expect(sheet.kind).toBe('none');
  });

  it('starts the return on Move and follows it into the moving sheet', async () => {
    const { native, controller, sheet, emit } = await offered();
    expect(sheet()).toBe('returnOffer');
    controller.act.returnMove();
    expect(native.startCardReturn).toHaveBeenCalledExactlyOnceWith(CARD);
    emit.progress(RETURNING);
    expect(sheet()).toBe('moving');
  });

  it('declines the card on Not now and closes', async () => {
    const { store, controller, sheet } = await offered();
    controller.act.declineReturn();
    expect(sheet()).toBe('none');
    expect(store.getState().declined).toEqual([CARD]);
  });

  it('shows a failed return with only OK, in the return’s words', async () => {
    const { controller, sheet, emit, store, settle } = await offered();
    controller.act.returnMove();
    await settle();
    emit.progress(RETURNING);
    emit.finished(
      finished(CODES.moveOutcomes.failed, CODES.moveErrors.noSpace),
    );
    await expect
      .poll(() => store.getState().error)
      .toBe(CODES.moveErrors.noSpace);
    expect(sheet()).toBe('returnFailed');
    expect(controller.returning()).toBe(true);
  });

  it('tells the finished return in the return’s words', async () => {
    const { controller, emit, notices } = await offered();
    controller.act.returnMove();
    emit.progress(RETURNING);
    emit.finished(finished(CODES.moveOutcomes.done));
    await expect.poll(() => notices.length).toBe(1);
    expect(notices[0]).toContain('are off the card');
  });

  it('forgets the return when an ordinary move starts', async () => {
    const { controller, emit } = await offered();
    controller.act.returnMove();
    emit.progress(RETURNING);
    emit.progress(move());
    expect(controller.returning()).toBe(false);
  });
});

describe('a card pulled while its offer is open', () => {
  it('closes the offer, and it stays closed when the card comes back', async () => {
    const { store, native, sheet } = await offered();
    native.listVolumes.mockResolvedValue({
      ...ON_PHONE,
      volumes: [INTERNAL, { ...RETURNED, state: CODES.volumeStates.unmounted }],
    });
    await store.getState().refreshVolumes();
    expect(sheet()).toBe('none');
    native.listVolumes.mockResolvedValue(WITH_CARD);
    await store.getState().refreshVolumes();
    expect(sheet()).toBe('none');
  });
});

describe('the outcome notice with two hosts', () => {
  it('is posted only by the host on screen', async () => {
    const { store, controller, emit, notices } = await offered();
    const behind: string[] = [];
    const hidden = createDataFolderSheetController(store, (text) => {
      behind.push(text);
    });
    hidden.subscribe(() => undefined);
    hidden.setFocused(false);
    controller.act.returnMove();
    emit.progress(RETURNING);
    emit.finished(finished(CODES.moveOutcomes.done));
    await expect.poll(() => notices.length).toBe(1);
    expect(behind).toEqual([]);
  });
});

describe('places come from the controller', () => {
  it('names the chosen target before a move starts, and the other place otherwise', async () => {
    const { store, native, controller } = await setup();
    native.listVolumes.mockResolvedValue(WITH_CARD);
    await store.getState().refreshVolumes();
    controller.open();
    expect(controller.places()).toEqual({
      source: null,
      target: CARD,
      cardReturn: false,
    });
    controller.choose(CARD);
    expect(controller.places()).toMatchObject({ source: null, target: CARD });
  });

  it('keeps the return’s places once its move is gone', async () => {
    const { controller, emit, settle } = await offered();
    controller.act.returnMove();
    await settle();
    emit.progress(RETURNING);
    emit.finished(finished(CODES.moveOutcomes.failed, CODES.moveErrors.io));
    expect(controller.places()).toEqual({
      source: CARD,
      target: null,
      cardReturn: true,
    });
  });
});

describe('ordinary moves keep their own failure sheet', () => {
  it('shows failed, not returnFailed, without a return', () => {
    const sheet = dataFolderSheet(
      { move: null, error: CODES.moveErrors.io, volumes: ON_PHONE },
      { kind: 'open' },
    );
    expect(sheet.kind).toBe('failed');
    expect(sheetActions(sheet, false).map((action) => action.id)).toEqual([
      'ok',
      'chooseAnother',
    ]);
    expect(
      sheetActions(
        { kind: 'returnFailed', error: CODES.moveErrors.io },
        false,
      ).map((a) => a.id),
    ).toEqual(['ok']);
  });
});
