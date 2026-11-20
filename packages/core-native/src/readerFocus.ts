import { findNodeHandle, type HostInstance } from 'react-native';

import { getKitbagCommands } from './NativeKitbagCommands';

export function focusReaderNode(node: HostInstance | null): void {
  if (node === null) return;
  const tag = findNodeHandle(node);
  if (typeof tag === 'number') getKitbagCommands().focusReaderView(tag);
}
