import { KB_RESULT } from './generated/nativeConstants.gen.ts';
import type { Spec } from './NativeKitbagCommands';

export type EngineHoldCommands = Pick<Spec, 'engineHold' | 'engineRelease'>;

const warnHoldFailed = (reason: unknown) => {
  console.warn('[kitbag] engine hold failed', reason);
};

const warnUnlessHeld = (result: number) => {
  if (result !== KB_RESULT.KB_OK) warnHoldFailed(result);
};

const releaseNothing = () => undefined;

export function acquireEngineHold(commands: EngineHoldCommands): () => void {
  let pending: Promise<number>;
  try {
    pending = commands.engineHold();
  } catch (error: unknown) {
    warnHoldFailed(error);
    return releaseNothing;
  }
  void pending.then(warnUnlessHeld, warnHoldFailed);
  return () => {
    commands.engineRelease();
  };
}
