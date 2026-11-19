import type {
  DataFolderVolume,
  DataFolderVolumes,
  MoveErrors,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { CARD, GB, MB, move } from './dataFolderMove.test-helper.ts';

import { DATA_FOLDER_CODES as CODES } from '@kitbag/core-state/src/dataFolder/codes.test-helper.ts';
import {
  moveErrorText,
  outcomeText,
  phaseText,
  pausedHint,
  progressFiles,
  stopHint,
  switchedFailedText,
  switchedHint,
  switchedTitle,
  undoneText,
} from './dataFolderMoveText.ts';
import {
  dataFolderRowValue,
  locationValue,
  mediaSize,
  mediaText,
  noSpaceHint,
  rowValueLabel,
  volumeOption,
} from './dataFolderText.ts';

const INTERNAL: DataFolderVolume = {
  volumeUuid: null,
  name: null,
  state: CODES.volumeStates.mounted,
  inUse: true,
  freeBytes: 41.2 * GB,
  totalBytes: 128 * GB,
  awayFiles: 0,
  awayBytes: 0,
  awayRequiredBytes: 0,
  awaySongs: 0,
  awayStemSongs: 0,
};

const SD: DataFolderVolume = {
  volumeUuid: CARD,
  name: 'SanDisk SD card',
  state: CODES.volumeStates.mounted,
  inUse: false,
  freeBytes: 58.3 * GB,
  totalBytes: 64 * GB,
  awayFiles: 0,
  awayBytes: 0,
  awayRequiredBytes: 0,
  awaySongs: 0,
  awayStemSongs: 0,
};

const VOLUMES: DataFolderVolumes = {
  currentVolumeUuid: null,
  currentAvailable: true,
  requiredBytes: 1.2 * GB,
  volumes: [INTERNAL, SD],
};

const MEDIA = { bytes: 1.2 * GB };

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
    const toCard = { source: null, target: CARD };
    expect(outcomeText(finished(outcomes.done), CODES, toCard)).toBe(
      'Move finished. Your files are on the SD card.',
    );
    expect(outcomeText(finished(outcomes.cancelled), CODES, toCard)).toBe(
      'Move stopped. Your files are still on internal storage.',
    );
    expect(outcomeText(finished(outcomes.awaitingRelease), CODES, toCard)).toBe(
      'Files moved to the SD card. The old copies are removed once nothing is playing from them.',
    );
    expect(outcomeText(finished(outcomes.failed), CODES, toCard)).toBeNull();
    expect(outcomeText(finished(outcomes.refused), CODES, toCard)).toBeNull();
  });

  it('says an undone move left the files where they were', () => {
    expect(undoneText(null)).toBe(
      'Move undone. Your files are still on internal storage.',
    );
  });

  it('gives every phase its own line', () => {
    const phases = Object.values(CODES.movePhases);
    const lines = phases.map((phase) => phaseText(phase, CODES.movePhases));
    expect(new Set(lines).size).toBe(phases.length);
    expect(phaseText(CODES.movePhases.verifying, CODES.movePhases)).toBe(
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

describe('media size', () => {
  it('counts song audio and stem sets, not the database that stays', () => {
    const report = {
      libraryAudio: { songs: 53, bytes: 880 * MB },
      stemSets: { count: 1, bytes: 320 * MB },
      database: { bytes: 1.2 * MB },
      location: '/data/user/0/com.kitbag.app/files/library',
    };
    expect(mediaSize(report)).toEqual({ bytes: 1.2 * GB });
    expect(mediaText(mediaSize(report))).toBe('1.2 GB');
  });
});

describe('after the switch', () => {
  const awaiting = move({
    phase: 'CLEANING',
    switched: true,
    running: false,
    awaitingRelease: true,
    cardReturn: false,
  });

  it('says the files are on the target while old copies wait', () => {
    const value = dataFolderRowValue(VOLUMES, awaiting);
    expect(rowValueLabel(value)).toBe(
      'Moved to SD card · old copies go once nothing plays',
    );
    expect(rowValueLabel(value)).not.toContain('%');
    expect(switchedTitle(awaiting)).toBe('Files moved to SD card');
    expect(switchedHint(awaiting)).toBe(
      'Your songs now play from the SD card. The old copies on internal storage are removed once nothing is playing from them.',
    );
  });

  it('says old copies are left when clean-up failed', () => {
    const failed = {
      ...awaiting,
      awaitingRelease: false,
      cardReturn: false,
      error: CODES.moveErrors.io,
    };
    expect(rowValueLabel(dataFolderRowValue(VOLUMES, failed))).toBe(
      'Moved to SD card · old copies left',
    );
    const text = switchedFailedText(failed);
    expect(text.title).toBe('Old copies left on internal storage');
    expect(text.body).toContain('Your files are on the SD card');
    expect(text.body).not.toContain('still plays from');
  });
});

describe('verifying counts', () => {
  const checking = move({ phase: 'VERIFYING', doneFiles: 10 });

  it('counts checked files as checked', () => {
    expect(progressFiles(checking, CODES.movePhases)).toEqual([
      '10',
      'of 54 files checked',
    ]);
    expect(progressFiles(move(), CODES.movePhases)).toEqual([
      '24',
      'of 54 files',
    ]);
  });

  it('counts every file as copied while checking', () => {
    expect(stopHint(checking, CODES.movePhases)).toContain(
      'The 54 files already copied',
    );
    expect(
      pausedHint({ ...checking, running: false }, CODES.movePhases),
    ).toContain('54 of 54 files are on the SD card');
  });
});

describe('one precision on a line', () => {
  it('reads free and needed space alike', () => {
    const full = { ...SD, freeBytes: 8.4 * GB };
    const big = { ...VOLUMES, requiredBytes: 12.1 * GB };
    expect(volumeOption(full, big, CODES, MEDIA).sub).toBe(
      '8.4 GB free · needs 12.1 GB',
    );
  });

  it('shows no free space for a card in use that is not mounted', () => {
    const gone = {
      ...SD,
      inUse: true,
      state: CODES.volumeStates.unmounted,
    };
    expect(volumeOption(gone, VOLUMES, CODES, MEDIA).sub).toBe('Not found');
  });
});
