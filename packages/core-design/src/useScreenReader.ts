import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (live) setEnabled(on);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setEnabled,
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}
