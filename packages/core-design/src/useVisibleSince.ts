import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useVisibleSince(): number {
  const [visibleSince, setVisibleSince] = useState(Date.now);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setVisibleSince(Date.now());
    });
    return () => {
      subscription.remove();
    };
  }, []);
  return visibleSince;
}
