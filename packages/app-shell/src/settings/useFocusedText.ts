import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useFocusedText<T>(
  read: () => Promise<T>,
  format: (value: T) => string | null,
  warning: string,
): string | null {
  const [text, setText] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      read()
        .then((value) => {
          if (live) setText(format(value));
        })
        .catch((error: unknown) => {
          console.warn(`[kitbag] ${warning}`, error);
        });
      return () => {
        live = false;
      };
    }, [read, format, warning]),
  );
  return text;
}
