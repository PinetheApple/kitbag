import { setReaderFocuser } from '@kitbag/core-design';
import { focusReaderNode } from '@kitbag/core-native';

export function installReaderFocus(): void {
  setReaderFocuser(focusReaderNode);
}
