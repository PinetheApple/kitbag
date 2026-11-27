import {
  getKitbagLibrary,
  readSharedBackup,
  takeLaunchIntake,
  watchIntake,
} from '@kitbag/core-native';

import type { IntakeDeps } from '../intake/receive.ts';
import type { IntakeSource } from '../intake/session.ts';

export const intakeSource: IntakeSource = {
  takeLaunch: takeLaunchIntake,
  watch: watchIntake,
};

export const intakeFiles: Pick<IntakeDeps, 'backupMimeType' | 'readBackup'> = {
  backupMimeType: () => getKitbagLibrary().getConstants().backupMimeType,
  readBackup: readSharedBackup,
};
