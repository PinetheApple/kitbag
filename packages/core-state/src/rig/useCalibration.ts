import { useStore, type StoreApi } from 'zustand';

import type { CalibrationSession } from './calibrationSession.ts';

export type CalibrationSessionStore = StoreApi<CalibrationSession>;

export function useCalibration<T>(
  session: CalibrationSessionStore,
  selector: (state: CalibrationSession) => T,
): T {
  return useStore(session, selector);
}
