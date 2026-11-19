import { useEffect, useState } from 'react';

interface Subscription {
  remove(): void;
}
type Handler = (enabled: boolean) => void;

export interface AccessibilitySetting {
  readonly read: () => Promise<boolean>;
  readonly subscribe: (handler: Handler) => Subscription;
}

export interface AccessibilitySource {
  isScreenReaderEnabled(): Promise<boolean>;
  isAccessibilityServiceEnabled(): Promise<boolean>;
  addEventListener(
    event: 'screenReaderChanged' | 'accessibilityServiceChanged',
    handler: Handler,
  ): Subscription;
}

// Android's flag is the accessibility on/off state: true while any service is
// enabled, TalkBack and Switch Access included; elsewhere only the screen reader.
export function readoutSetting(
  os: string,
  info: AccessibilitySource,
): AccessibilitySetting {
  if (os === 'android') {
    return {
      read: () => info.isAccessibilityServiceEnabled(),
      subscribe: (handler) =>
        info.addEventListener('accessibilityServiceChanged', handler),
    };
  }
  return {
    read: () => info.isScreenReaderEnabled(),
    subscribe: (handler) =>
      info.addEventListener('screenReaderChanged', handler),
  };
}

export function useAccessibilitySetting({
  read,
  subscribe,
}: AccessibilitySetting): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    read().then(
      (on) => {
        if (live) setEnabled(on);
      },
      () => undefined,
    );
    const subscription = subscribe(setEnabled);
    return () => {
      live = false;
      subscription.remove();
    };
  }, [read, subscribe]);
  return enabled;
}
