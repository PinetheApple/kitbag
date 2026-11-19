import { KB_RESULT } from './generated/nativeConstants.gen.ts';
import { isCustomSoundSlot } from './customSoundIds.ts';
import { getKitbagCommands } from './NativeKitbagCommands';
import { getKitbagLibrary } from './NativeKitbagLibrary';

type ResultOf<Name extends keyof typeof KB_RESULT> = (typeof KB_RESULT)[Name];

export type PrepareClickSoundResult = ResultOf<
  | 'KB_OK'
  | 'KB_ERROR_INVALID_ARGUMENT'
  | 'KB_ERROR_TOO_LONG'
  | 'KB_ERROR_SILENT'
  | 'KB_ERROR_NO_SPACE'
  | 'KB_ERROR_INTERNAL'
>;

export type LoadCustomSoundResult = ResultOf<
  | 'KB_OK'
  | 'KB_ERROR_INVALID_ARGUMENT'
  | 'KB_ERROR_TOO_LONG'
  | 'KB_ERROR_INTERNAL'
>;

const PREPARE_RESULTS: readonly number[] = [
  KB_RESULT.KB_OK,
  KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
  KB_RESULT.KB_ERROR_TOO_LONG,
  KB_RESULT.KB_ERROR_SILENT,
  KB_RESULT.KB_ERROR_NO_SPACE,
  KB_RESULT.KB_ERROR_INTERNAL,
];

const LOAD_RESULTS: readonly number[] = [
  KB_RESULT.KB_OK,
  KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
  KB_RESULT.KB_ERROR_TOO_LONG,
  KB_RESULT.KB_ERROR_INTERNAL,
];

function isPrepareResult(value: number): value is PrepareClickSoundResult {
  return PREPARE_RESULTS.includes(value);
}

function isLoadResult(value: number): value is LoadCustomSoundResult {
  return LOAD_RESULTS.includes(value);
}

export async function prepareClickSound(
  sourceUri: string,
  fileName: string,
): Promise<PrepareClickSoundResult> {
  const result = await getKitbagLibrary().prepareClickSound(
    sourceUri,
    fileName,
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
