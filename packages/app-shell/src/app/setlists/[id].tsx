import { SetlistDetailScreen } from '@kitbag/tool-metronome';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function SetlistDetailRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SetlistDetailScreen
      setlistId={Number(id)}
      insets={insets}
      onBack={routes.back}
      onEditPreset={routes.openPreset}
      onLoaded={routes.toMetronome}
    />
  );
}
