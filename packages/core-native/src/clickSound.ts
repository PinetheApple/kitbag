import { KB_RESULT } from './generated/nativeConstants.gen.ts';
import { isCustomSoundSlot } from './customSoundIds.ts';
import { getKitbagCommands } from './NativeKitbagCommands';
import { getKitbagLibrary } from './NativeKitbagLibrary';

const PREPARE_RESULTS = [
  KB_RESULT.KB_OK,
  KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
  KB_RESULT.KB_ERROR_TOO_LONG,
  KB_RESULT.KB_ERROR_SILENT,
  KB_RESULT.KB_ERROR_NO_SPACE,
  KB_RESULT.KB_ERROR_INTERNAL,
] as const;

const LOAD_RESULTS = [
  KB_RESULT.KB_OK,
  KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
  KB_RESULT.KB_ERROR_TOO_LONG,
  KB_RESULT.KB_ERROR_INTERNAL,
] as const;

export type PrepareClickSoundResult = (typeof PREPARE_RESULTS)[number];
export type LoadCustomSoundResult = (typeof LOAD_RESULTS)[number];

function isPrepareResult(value: number): value is PrepareClickSoundResult {
  return (PREPARE_RESULTS as readonly number[]).includes(value);
}

function isLoadResult(value: number): value is LoadCustomSoundResult {
  return (LOAD_RESULTS as readonly number[]).includes(value);
}

export async function prepareClickSound(
  sourceUri: string,
  freshFileName: string,
): Promise<PrepareClickSoundResult> {
  const result = await getKitbagLibrary().prepareClickSound(
    sourceUri,
    freshFileName,
  );
  return isPrepareResult(result) ? result : KB_RESULT.KB_ERROR_INTERNAL;
}

export async function loadCustomSound(
  slot: number,
  fileName: string,
): Promise<LoadCustomSoundResult> {
  if (!isCustomSoundSlot(slot)) return KB_RESULT.KB_ERROR_INVALID_ARGUMENT;
  const result = await getKitbagCommands().loadCustomSound(slot, fileName);
  return isLoadResult(result) ? result : KB_RESULT.KB_ERROR_INTERNAL;
}

export function clearCustomSound(slot: number): void {
  if (isCustomSoundSlot(slot)) getKitbagCommands().clearCustomSound(slot);
}

export function customSoundLoaded(slot: number): Promise<boolean> {
  if (!isCustomSoundSlot(slot)) return Promise.resolve(false);
  return getKitbagCommands().customSoundLoaded(slot);
}

export function readClickSound(fileName: string): Promise<string> {
  return getKitbagLibrary().readClickSound(fileName);
}

export function writeClickSound(
  fileName: string,
  wavBase64: string,
): Promise<void> {
  return getKitbagLibrary().writeClickSound(fileName, wavBase64);
}

export function deleteClickSound(fileName: string): Promise<void> {
  return getKitbagLibrary().deleteClickSound(fileName);
}

export function listClickSounds(): Promise<readonly string[]> {
  return getKitbagLibrary().listClickSounds();
}
