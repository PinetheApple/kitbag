import { SetlistsScreen } from '@kitbag/tool-metronome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function SetlistsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  return (
    <SetlistsScreen
      insets={insets}
      onBack={routes.back}
      onOpenSetlist={routes.openSetlist}
      onOpenAllSongs={routes.openAllSongs}
      onLoaded={routes.toMetronome}
    />
  );
}
