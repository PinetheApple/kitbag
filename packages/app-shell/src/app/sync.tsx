import { useLastTool } from '@kitbag/core-state';
import { PlayAlongScreen } from '@kitbag/tool-sync';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useBackOrHome } from '@/runtime/backOrHome';

function SyncRoute() {
  const insets = useSafeAreaInsets();
  const markUsed = useLastTool((s) => s.markUsed);
  const goBack = useBackOrHome();

  useEffect(() => {
    markUsed(TOOL_ID.sync);
  }, [markUsed]);

  return <PlayAlongScreen insets={insets} onBack={goBack} />;
}

export default gated(TOOL_ID.sync, SyncRoute);
