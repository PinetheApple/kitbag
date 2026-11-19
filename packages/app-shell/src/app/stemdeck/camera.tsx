import { CameraExplainerScreen } from '@kitbag/tool-stems';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useStemDeckRoutes } from '@/runtime/stemDeckRoutes';

function StemDeckCameraRoute() {
  const insets = useSafeAreaInsets();
  const routes = useStemDeckRoutes();
  return <CameraExplainerScreen insets={insets} onBack={routes.back} />;
}

export default gated(TOOL_ID.stems, StemDeckCameraRoute);
