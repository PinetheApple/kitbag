import type { StemDeckScanLook } from '@kitbag/core-native';

import type { PermissionAnswer } from '../permission.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import { stemDeckCodes } from './runtime.ts';
import type { Get, SetState, StemDeckDeps } from './store.ts';

export interface ScanState {
  readonly address: string;
  readonly addressFocus: number;
  readonly camera: PermissionAnswer | null;
}

export interface ScanActions {
  setAddress: (address: string) => void;
  typeAddress: () => void;
  scanAddress: (
    look: StemDeckScanLook,
    ask: boolean,
  ) => Promise<PermissionAnswer>;
  openCameraSettings: () => void;
}

const DENIED: PermissionAnswer = 'denied';
const BLOCKED: PermissionAnswer = 'blocked';

export function scanActions(
  deps: StemDeckDeps,
  set: SetState,
  get: Get,
): ScanActions {
  const typeAddress = () => {
    set({ addressFocus: get().addressFocus + 1 });
  };

  const permission = async (ask: boolean) => {
    try {
      const camera = deps.camera();
      return await (ask ? camera.request() : camera.check());
    } catch (error) {
      warn('camera permission unavailable', error);
      return DENIED;
    }
  };

  const scan = async (look: StemDeckScanLook) => {
    try {
      return await deps.native().scanQr(look);
    } catch (error) {
      warn('QR scanner did not open', error);
      return null;
    }
  };

  return {
    setAddress: (address: string) => {
      set({ address });
    },
    typeAddress,
    // Resolves once the scanner closes, not once the connection settles. A
    // check cannot tell blocked from denied, so it keeps a block it has seen.
    scanAddress: async (look: StemDeckScanLook, ask: boolean) => {
      const checked = await permission(ask);
      const keepsBlock = !ask && checked === DENIED && get().camera === BLOCKED;
      const answer = keepsBlock ? BLOCKED : checked;
      set({ camera: answer });
      if (answer !== 'granted') return answer;
      const result = await scan(look);
      const codes = stemDeckCodes(deps.native, get().codes);
      if (result === null || codes === null) return answer;
      if (result.outcome === codes.scanTypeAddress) typeAddress();
      else if (result.outcome === codes.scanRead && result.text !== null)
        get()
          .connect(result.text)
          .catch((error: unknown) => {
            warn('StemDeck connect failed', error);
          });
      return answer;
    },
    openCameraSettings: () => {
      deps.camera().openSettings();
    },
  };
}
