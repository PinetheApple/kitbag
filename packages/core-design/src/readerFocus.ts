import { AccessibilityInfo, type HostInstance } from 'react-native';

export function focusReaderOn(node: HostInstance | null): void {
  if (node !== null) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
}
