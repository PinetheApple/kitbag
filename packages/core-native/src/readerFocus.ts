import { findNodeHandle, type HostInstance } from 'react-native';

import { getKitbagCommands } from './NativeKitbagCommands';

// findNodeHandle resolves host instances (RN's TextInputState passes them);
// its TS signature predates them.
type NodeHandleSource = Parameters<typeof findNodeHandle>[0];

export function focusReaderNode(node: HostInstance | null): void {
  if (node === null) return;
  const tag = findNodeHandle(node as unknown as NodeHandleSource);
  if (tag !== null) getKitbagCommands().focusReaderView(tag);
}
