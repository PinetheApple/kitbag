import { createContext, useContext } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export const SheetContentLiveContext =
  createContext<SharedValue<boolean> | null>(null);

// False while the sheet holding this content leaves: an update to a view the
// exit is about to remove can crash Android (reanimated#7493).
export function useSheetContentLive(): SharedValue<boolean> {
  const outsideSheet = useSharedValue(true);
  return useContext(SheetContentLiveContext) ?? outsideSheet;
}
