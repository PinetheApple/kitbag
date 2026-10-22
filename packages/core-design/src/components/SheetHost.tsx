import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { removeSheet, upsertSheet, type SheetSlot } from '../sheetSlots.ts';

interface SheetPortal {
  readonly show: (id: string, node: ReactNode) => void;
  readonly hide: (id: string) => void;
}

const SheetPortalContext = createContext<SheetPortal | null>(null);

// Sheets draw here, over the whole app, instead of in an RN Modal: a Modal is
// its own Android window, which sizes itself wrong for the keyboard (#142).
export function SheetHost({ children }: { readonly children: ReactNode }) {
  const [slots, setSlots] = useState<readonly SheetSlot[]>([]);
  const show = useCallback((id: string, node: ReactNode) => {
    setSlots((current) => upsertSheet(current, id, node));
  }, []);
  const hide = useCallback((id: string) => {
    setSlots((current) => removeSheet(current, id));
  }, []);
  const portal = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <SheetPortalContext.Provider value={portal}>
      {children}
      {slots.map((slot) => (
        <View key={slot.id} style={StyleSheet.absoluteFill}>
          {slot.node}
        </View>
      ))}
    </SheetPortalContext.Provider>
  );
}

export function useSheetPortal(): SheetPortal {
  const portal = useContext(SheetPortalContext);
  if (portal === null) throw new Error('Sheet rendered outside a SheetHost');
  return portal;
}
