import { KB_RESULT } from './generated/nativeConstants.gen.ts';
import type { Spec } from './NativeKitbagCommands';

export type EngineHoldCommands = Pick<Spec, 'engineHold' | 'engineRelease'>;

const warnHoldFailed = (reason: unknown) => {
  console.warn('[kitbag] engine hold failed', reason);
};

// The engine needs one release per hold call, whatever the hold returned or threw.
export function holdEngine(commands: EngineHoldCommands): () => void {
  const hold = async () => commands.engineHold();
  hold()
    .then((result) => {
      if (result !== KB_RESULT.KB_OK) warnHoldFailed(result);
    })
    .catch(warnHoldFailed);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    commands.engineRelease();
  };
}
