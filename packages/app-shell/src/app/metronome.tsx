import { MetronomeScreen } from '@kitbag/tool-metronome';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MetronomeRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openSetlists = useCallback(() => {
    router.push('/setlists');
  }, [router]);
  return <MetronomeScreen insets={insets} onOpenSetlists={openSetlists} />;
}
