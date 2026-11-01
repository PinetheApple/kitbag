import { useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useBackOrHome(): () => void {
  const router = useRouter();
  // Opened as the first route, there is no history to go back to.
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
}
