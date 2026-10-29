import { useEffect, useRef } from 'react';
import { KeyboardEvents } from 'react-native-keyboard-controller';

export function useKeyboardDidHide(handler: () => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const subscription = KeyboardEvents.addListener('keyboardDidHide', () => {
      latest.current();
    });
    return () => {
      subscription.remove();
    };
  }, []);
}
