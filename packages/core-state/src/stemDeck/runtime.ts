import type {
  KitbagStemDeckSpec,
  StemDeckConstants,
  StemDeckImportSnapshot,
} from '@kitbag/core-native';

import { warn } from '../songLibrary/storeSupport.ts';

export type StemDeckNative = Pick<
  KitbagStemDeckSpec,
  | 'probe'
  | 'trust'
  | 'forget'
  | 'knownServers'
  | 'getJson'
  | 'startImport'
  | 'cancelImport'
  | 'retryImport'
  | 'importSnapshot'
  | 'settleDownload'
  | 'setWatching'
> & {
  readonly constants: () => StemDeckConstants;
  readonly onImport: (
    listener: (snapshot: StemDeckImportSnapshot) => void,
  ) => () => void;
};

export interface UnityNoticePersistence {
  readonly load: () => boolean;
  readonly save: () => void;
}

export interface StemDeckRuntime {
  readonly native: StemDeckNative;
  readonly unityNotice: UnityNoticePersistence;
}

export function stemDeckCodes(
  native: () => StemDeckNative,
  known: StemDeckConstants | null,
): StemDeckConstants | null {
  if (known !== null) return known;
  try {
    return native().constants();
  } catch (error) {
    warn('StemDeck constants unavailable', error);
    return null;
  }
}

let configured: StemDeckRuntime | undefined;

export function configureStemDeck(runtime: StemDeckRuntime): void {
  if (configured !== undefined && configured !== runtime) {
    throw new Error('StemDeck is already configured');
  }
  configured = runtime;
}

export function getStemDeck(): StemDeckRuntime {
  if (configured === undefined) {
    throw new Error('StemDeck is not configured');
  }
  return configured;
}
