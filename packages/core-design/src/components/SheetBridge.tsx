import {
  createContext,
  useCallback,
  useContext,
  type Context,
  type ReactNode,
} from 'react';

export type SheetWrap = (node: ReactNode) => ReactNode;

const keep: SheetWrap = (node) => node;

const SheetBridgeContext = createContext<SheetWrap>(keep);

// Sheets draw at the SheetHost, outside the providers of the tree that opens them.
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

export function BridgedProvider<T>({
  context,
  value,
  children,
}: {
  readonly context: Context<T>;
  readonly value: T;
  readonly children: ReactNode;
}) {
  const wrap = useCallback<SheetWrap>(
    (node) => <context.Provider value={value}>{node}</context.Provider>,
    [context, value],
  );
  return (
    <context.Provider value={value}>
      <SheetBridge wrap={wrap}>{children}</SheetBridge>
    </context.Provider>
  );
}
