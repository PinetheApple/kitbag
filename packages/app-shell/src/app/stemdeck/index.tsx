import { ConnectScreen } from '@kitbag/tool-stems';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useStemDeckRoutes } from '@/runtime/stemDeckRoutes';

function StemDeckConnectRoute() {
  const insets = useSafeAreaInsets();
  const routes = useStemDeckRoutes();
  return (
    <ConnectScreen
      insets={insets}
      onBack={routes.back}
      onConnected={routes.openSongs}
      onExplainCamera={routes.openCameraExplainer}
    />
  );
}

export default gated(TOOL_ID.stems, StemDeckConnectRoute);
