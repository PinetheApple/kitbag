import { getMixdownHost } from './host/KitbagHostObject.ts';
import {
  KB_MIXDOWN_STATE,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';
import { getKitbagCommands } from './NativeKitbagCommands';
import { getKitbagLibrary } from './NativeKitbagLibrary';

/** Started, with where the file will be; or refused, with why. */
export type MixdownStart =
  | Readonly<{ result: typeof KB_RESULT.KB_OK; path: string }>
  | Readonly<{ result: Exclude<KB_RESULT, typeof KB_RESULT.KB_OK> }>;

const STATES: readonly number[] = Object.values(KB_MIXDOWN_STATE);
const RESULTS: readonly number[] = Object.values(KB_RESULT);

function isMixdownState(value: number): value is KB_MIXDOWN_STATE {
  return STATES.includes(value);
}

function isRefusal(
  value: number,
): value is Exclude<KB_RESULT, typeof KB_RESULT.KB_OK> {
  return value !== KB_RESULT.KB_OK && RESULTS.includes(value);
}

export async function mixdownStart(fileName: string): Promise<MixdownStart> {
  const reply = await getKitbagCommands().mixdownStart(fileName);
  if (reply.result === KB_RESULT.KB_OK) {
    return { result: KB_RESULT.KB_OK, path: reply.path };
  }
  return {
    result: isRefusal(reply.result)
      ? reply.result
      : KB_RESULT.KB_ERROR_INTERNAL,
  };
}

export function mixdownCancel(): void {
  getKitbagCommands().mixdownCancel();
}

export function shareExport(path: string): Promise<void> {
  return getKitbagLibrary().shareExport(path);
}

export function mixdownProgress(): number {
  return getMixdownHost().mixdown_progress;
}

export function mixdownState(): KB_MIXDOWN_STATE {
  const state = getMixdownHost().mixdown_state;
  return isMixdownState(state) ? state : KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_IDLE;
}
