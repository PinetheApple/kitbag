import type { ClickSoundRepository } from '@kitbag/core-db';
import type {
  LibraryConstants,
  LoadCustomSoundResult,
  PickedDocument,
  PrepareClickSoundResult,
} from '@kitbag/core-native';

import type { ReleasedSounds } from './released.ts';

export interface ClickSoundDeps {
  readonly repository: () => ClickSoundRepository;
  readonly prepare: (
    sourceUri: string,
    fileName: string,
  ) => Promise<PrepareClickSoundResult>;
  readonly load: (
    slot: number,
    fileName: string,
  ) => Promise<LoadCustomSoundResult>;
  readonly clear: (slot: number) => void;
  readonly deleteFile: (fileName: string) => Promise<void>;
  readonly newUuid: () => string;
  readonly freshFileName: () => string;
  readonly afterRemove: (soundId: number) => Promise<ReleasedSounds>;
  readonly afterRestore: (
    soundId: number,
    released: ReleasedSounds,
  ) => Promise<void>;
  readonly pickDocument: () => Promise<PickedDocument | null>;
  readonly sniffUnsupportedFormat: (uri: string) => Promise<string>;
  readonly constants: () => LibraryConstants;
  readonly listFiles: () => Promise<readonly string[]>;
  readonly clearPartials: () => Promise<void>;
  readonly now: () => number;
}

let configured: ClickSoundDeps | undefined;

export function configureClickSounds(deps: ClickSoundDeps): void {
  if (configured === undefined) {
    configured = deps;
    return;
  }
  if (configured !== deps) {
    throw new Error('Click sounds are already configured');
  }
}

export function getClickSounds(): ClickSoundDeps {
  if (configured === undefined) {
    throw new Error('Click sounds are not configured');
  }
  return configured;
}
