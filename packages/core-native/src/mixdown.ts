import { getMixdownHost } from './host/KitbagHostObject.ts';
import {
  KB_MIXDOWN_STATE,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';
import { getKitbagCommands } from './NativeKitbagCommands';
import { getKitbagLibrary } from './NativeKitbagLibrary';

export type MixdownStart = Readonly<{ result: number; path?: string }>;

const STATES: readonly number[] = Object.values(KB_MIXDOWN_STATE);

function isMixdownState(value: number): value is KB_MIXDOWN_STATE {
  return STATES.includes(value);
}

/** `path` only when the render started; poll mixdownState() until it ends. */
export async function mixdownStart(fileName: string): Promise<MixdownStart> {
  const reply = await getKitbagCommands().mixdownStart(fileName);
  return reply.result === KB_RESULT.KB_OK
    ? { result: reply.result, path: reply.path }
    : { result: reply.result };
}

export function mixdownCancel(): void {
  getKitbagCommands().mixdownCancel();
}

export function shareFile(path: string, mime: string): Promise<void> {
  return getKitbagLibrary().shareFile(path, mime);
}

export function mixdownProgress(): number {
  return getMixdownHost().mixdown_progress;
}

export function mixdownState(): KB_MIXDOWN_STATE {
  const state = getMixdownHost().mixdown_state;
  return isMixdownState(state) ? state : KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_IDLE;
}
