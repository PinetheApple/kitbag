import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { readerHiding } from '../readerHiding.ts';
import {
  removeSheet,
  upsertSheet,
  type SheetSlot,
  type SheetSlotState,
} from '../sheetSlots.ts';

interface SheetPortal {
  readonly show: (id: string, node: ReactNode, state: SheetSlotState) => void;
  readonly hide: (id: string) => void;
  readonly topInset: number;
}

export interface SheetHostProps {
  readonly topInset: number;
  readonly children: ReactNode;
}

const SheetPortalContext = createContext<SheetPortal | null>(null);

const styles = StyleSheet.create({ app: { flex: 1 } });

// Sheets draw here, over the whole app, instead of in an RN Modal: a Modal is
// its own Android window, which sizes itself wrong for the keyboard (#142).
export function SheetHost({ topInset, children }: SheetHostProps) {
  const [slots, setSlots] = useState<readonly SheetSlot[]>([]);
  const show = useCallback(
    (id: string, node: ReactNode, state: SheetSlotState) => {
      setSlots((current) => upsertSheet(current, id, node, state));
    },
    [],
  );
  const hide = useCallback((id: string) => {
    setSlots((current) => removeSheet(current, id));
  }, []);
  const portal = useMemo(
    () => ({ show, hide, topInset }),
    [show, hide, topInset],
  );
  const top = slots.findLastIndex((slot) => slot.state === 'open');
  return (
    <SheetPortalContext.Provider value={portal}>
      <View
        style={styles.app}
        collapsable={false}
        {...readerHiding(top !== -1)}
      >
        {children}
      </View>
      {slots.map((slot, index) => (
        <View
          key={slot.id}
          style={StyleSheet.absoluteFill}
          collapsable={false}
          pointerEvents={slot.state === 'leaving' ? 'none' : 'auto'}
          {...readerHiding(index !== top)}
        >
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
