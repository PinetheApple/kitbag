import { AllSongsScreen } from '@kitbag/tool-metronome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function AllSongsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  return (
    <AllSongsScreen
      insets={insets}
      onBack={routes.back}
      onEditPreset={routes.openPreset}
      onLoaded={routes.toMetronome}
    />
  );
}
