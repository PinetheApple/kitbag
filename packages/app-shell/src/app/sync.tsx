import type { OutputRoute } from '@kitbag/core-native';
import { routeTitle, useLastTool, useRouteLatency } from '@kitbag/core-state';
import { PlayAlongScreen, type PlayAlongRoute } from '@kitbag/tool-sync';
import { useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useBackOrHome } from '@/runtime/backOrHome';
import { routeLatency } from '@/settings/rigRuntime';
import { ROUTE_ICON } from '@/settings/routeIcon';

function playAlongRoute(live: OutputRoute | null): PlayAlongRoute | undefined {
  if (live === null) return undefined;
  return { icon: ROUTE_ICON[live.kind], label: routeTitle(live) };
}

function SyncRoute() {
  const insets = useSafeAreaInsets();
  const markUsed = useLastTool((s) => s.markUsed);
  const goBack = useBackOrHome();
  const live = useRouteLatency(routeLatency, (s) => s.live);
  const route = useMemo(() => playAlongRoute(live), [live]);

  useEffect(() => {
    markUsed(TOOL_ID.sync);
  }, [markUsed]);

  return <PlayAlongScreen insets={insets} route={route} onBack={goBack} />;
}

export default gated(TOOL_ID.sync, SyncRoute);
