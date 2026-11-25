import { createContext, useCallback, useContext, type ReactNode } from 'react';

export type SheetWrap = (node: ReactNode) => ReactNode;

const keep: SheetWrap = (node) => node;

const SheetBridgeContext = createContext<SheetWrap>(keep);

// Sheets draw at the SheetHost, outside the tree that opens them; a bridge
// carries that tree's own providers across to the sheet.
export function SheetBridge({
  wrap,
  children,
}: {
  readonly wrap: SheetWrap;
  readonly children: ReactNode;
}) {
  const outer = useContext(SheetBridgeContext);
  const bridged = useCallback<SheetWrap>(
    (node) => outer(wrap(node)),
    [outer, wrap],
  );
  return (
    <SheetBridgeContext.Provider value={bridged}>
      {children}
    </SheetBridgeContext.Provider>
  );
}

export function useSheetBridge(): SheetWrap {
  return useContext(SheetBridgeContext);
}
