import { ImportProgressScreen } from '@kitbag/tool-stems';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useStemDeckRoutes } from '@/runtime/stemDeckRoutes';

function StemDeckImportRoute() {
  const insets = useSafeAreaInsets();
  const routes = useStemDeckRoutes();
  return (
    <ImportProgressScreen
      insets={insets}
      onBack={routes.back}
      onOpenStemSongs={routes.openStemSongs}
    />
  );
}

export default gated(TOOL_ID.stems, StemDeckImportRoute);
