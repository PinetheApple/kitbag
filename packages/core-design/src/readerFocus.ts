import { AccessibilityInfo, type HostInstance } from 'react-native';

export type ReaderFocuser = (node: HostInstance) => void;

function sendFocusEvent(node: HostInstance): void {
  AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
}

let focuser: ReaderFocuser = sendFocusEvent;

export function setReaderFocuser(next: ReaderFocuser): void {
  focuser = next;
}

export function focusReaderOn(node: HostInstance | null): void {
  if (node !== null) focuser(node);
}
