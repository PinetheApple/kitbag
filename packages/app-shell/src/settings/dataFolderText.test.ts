import type {
  DataFolderVolume,
  DataFolderVolumes,
  MoveErrors,
  MoveStatus,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { DATA_FOLDER_CODES as CODES } from './dataFolderCodes.test-helper.ts';
import {
  dataFolderRowValue,
  locationValue,
  moveErrorText,
  noSpaceHint,
  outcomeText,
  phaseText,
  rowValueLabel,
  volumeOption,
} from './dataFolderText.ts';

const CARD = '1234-ABCD';
const GB = 1_000_000_000;
const MB = 1_000_000;

const INTERNAL: DataFolderVolume = {
  volumeUuid: null,
  name: null,
  state: CODES.volumeStates.mounted,
  inUse: true,
  freeBytes: 41.2 * GB,
  totalBytes: 128 * GB,
};

const SD: DataFolderVolume = {
  volumeUuid: CARD,
  name: 'SanDisk SD card',
  state: CODES.volumeStates.mounted,
  inUse: false,
  freeBytes: 58.3 * GB,
  totalBytes: 64 * GB,
};

const VOLUMES: DataFolderVolumes = {
  currentVolumeUuid: null,
  currentAvailable: true,
  requiredBytes: 1.2 * GB,
  volumes: [INTERNAL, SD],
};

const MEDIA = { bytes: 1.2 * GB, files: 54 };

function move(fields: Partial<MoveStatus> = {}): MoveStatus {
  return {
    phase: 'COPYING',
    sourceVolumeUuid: null,
    targetVolumeUuid: CARD,
    doneBytes: 540 * MB,
    totalBytes: 1.2 * GB,
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

const TO_CARD = { source: null, target: CARD };

describe('move error messages', () => {
  const keys = Object.keys(CODES.moveErrors) as (keyof MoveErrors)[];
  const messages = keys.map((key) =>
    moveErrorText(CODES.moveErrors[key], CODES, TO_CARD),
  );

  it('gives every error code its own title and its own body', () => {
    expect(new Set(messages.map((m) => m.title)).size).toBe(keys.length);
    expect(new Set(messages.map((m) => m.body)).size).toBe(keys.length);
  });

  it('says the files are safe and where for the design’s failures', () => {
    const notWritable = moveErrorText(
      CODES.moveErrors.targetNotWritable,
      CODES,
      TO_CARD,
    );
    expect(notWritable.title).toBe('Can’t write to SD card');
    expect(notWritable.body).toContain(
      'Nothing was moved. Your files are still on internal storage.',
    );
    const mismatch = moveErrorText(
      CODES.moveErrors.hashMismatch,
      CODES,
      TO_CARD,
    );
    expect(mismatch.title).toBe('Move didn’t finish');
    expect(mismatch.body).toContain(
      'Every song still plays from internal storage.',
    );
  });

  it('names the places of a move back to the phone', () => {
    const occupied = moveErrorText(CODES.moveErrors.targetOccupied, CODES, {
      source: CARD,
      target: null,
    });
    expect(occupied.body).toContain('Your files are still on the SD card.');
  });

  it('reads an unknown code as an i/o failure', () => {
    expect(moveErrorText('E_SOMETHING_NEW', CODES, TO_CARD)).toEqual(
      moveErrorText(CODES.moveErrors.io, CODES, TO_CARD),
    );
  });
});

describe('outcome and phase text', () => {
  it('says where the files are after a move or a cancel', () => {
    const { moveOutcomes: outcomes } = CODES;
    const finished = (outcome: string) => ({
      outcome,
      error: null,
      path: null,
    });
    expect(outcomeText(finished(outcomes.done), CODES, CARD)).toBe(
      'Move finished. Your files are on the SD card.',
    );
    expect(outcomeText(finished(outcomes.cancelled), CODES, null)).toBe(
      'Move stopped. Your files are still on internal storage.',
    );
    expect(outcomeText(finished(outcomes.awaitingRelease), CODES, CARD)).toBe(
      'Files moved to the SD card. The old copies are removed once nothing is playing from them.',
    );
    expect(outcomeText(finished(outcomes.failed), CODES, null)).toBeNull();
    expect(outcomeText(finished(outcomes.refused), CODES, null)).toBeNull();
  });

  it('gives every phase its own line', () => {
    const lines = CODES.movePhases.map((phase) => phaseText(phase, CODES));
    expect(new Set(lines).size).toBe(CODES.movePhases.length);
    expect(phaseText('VERIFYING', CODES)).toBe(
      'Checking every copy against its original.',
    );
  });
});

describe('data folder row', () => {
  it('names the volume and its free space', () => {
    const value = dataFolderRowValue(VOLUMES, null);
    expect(rowValueLabel(value)).toBe('Internal storage · 41.2 GB free');
    expect(value.highlighted).toBe(false);
  });

  it('names a card by its system name', () => {
    const onCard = {
      ...VOLUMES,
      currentVolumeUuid: CARD,
      volumes: [
        { ...INTERNAL, inUse: false },
        { ...SD, inUse: true },
      ],
    };
    expect(rowValueLabel(dataFolderRowValue(onCard, null))).toBe(
      'SanDisk SD card · 58.3 GB free',
    );
  });

  it('reads the move while it runs, highlighted', () => {
    const value = dataFolderRowValue(VOLUMES, move());
    expect(rowValueLabel(value)).toBe('Moving to SD card · 45%');
    expect(value.highlighted).toBe(true);
  });

  it('shows a stopped move as paused', () => {
    const stopped = move({ running: false, paused: true });
    expect(rowValueLabel(dataFolderRowValue(VOLUMES, stopped))).toBe(
      'Move to SD card paused',
    );
  });

  it('marks a missing folder in words', () => {
    const gone = {
      ...VOLUMES,
      currentVolumeUuid: CARD,
      currentAvailable: false,
      volumes: [{ ...INTERNAL, inUse: false }],
    };
    const value = dataFolderRowValue(gone, null);
    expect(rowValueLabel(value)).toBe('SD card · not found');
    expect(value.missing).toBe(true);
  });
});

describe('storage location', () => {
  it('names where files are read from, and the copy under way', () => {
    expect(locationValue(VOLUMES, null)).toEqual({
      volume: 'Internal storage',
      moving: null,
    });
    expect(locationValue(VOLUMES, move()).moving).toBe('→ SD card · 45%');
  });

  it('drops the copy note once the folder switched', () => {
    const switched = move({ phase: 'CLEANING', switched: true });
    expect(locationValue(VOLUMES, switched).moving).toBeNull();
  });
});

describe('volume options', () => {
  it('marks the volume in use with its free and used space', () => {
    expect(volumeOption(INTERNAL, VOLUMES, CODES, MEDIA)).toMatchObject({
      name: 'Internal storage',
      sub: '41.2 GB free · 1.2 GB used',
      inUse: true,
      offered: false,
    });
  });

  it('offers a card with room', () => {
    expect(volumeOption(SD, VOLUMES, CODES, MEDIA)).toMatchObject({
      sub: '58.3 GB free',
      offered: true,
      shortBy: null,
    });
  });

  it('disables a full card and says how much is missing', () => {
    const full = { ...SD, freeBytes: 640 * MB };
    const option = volumeOption(full, VOLUMES, CODES, MEDIA);
    expect(option).toMatchObject({
      sub: '640 MB free · needs 1.2 GB',
      offered: false,
    });
    expect(noSpaceHint(option)).toBe(
      'Free up 560 MB on the SD card to move here. Nothing has moved.',
    );
  });

  it('disables a read-only card with the reason on the row', () => {
    const readOnly = { ...SD, state: CODES.volumeStates.readOnly };
    expect(volumeOption(readOnly, VOLUMES, CODES, MEDIA)).toMatchObject({
      sub: 'Read-only. Kitbag can’t write to this card.',
      offered: false,
      shortBy: null,
    });
  });
});
