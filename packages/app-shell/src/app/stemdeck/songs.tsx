import { SongListScreen } from '@kitbag/tool-stems';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useStemDeckRoutes } from '@/runtime/stemDeckRoutes';

function StemDeckSongsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useStemDeckRoutes();
  return (
    <SongListScreen
      insets={insets}
      onBack={routes.back}
      onImporting={routes.openImport}
    />
  );
}

export default gated(TOOL_ID.stems, StemDeckSongsRoute);
