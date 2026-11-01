import { useLastTool } from '@kitbag/core-state';
import { MetronomeScreen } from '@kitbag/tool-metronome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';

// The shell, not the tool, records the visit for Home's Continue card.
function MetronomeRouteBody() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const markUsed = useLastTool((s) => s.markUsed);

  useEffect(() => {
    markUsed(TOOL_ID.metronome);
  }, [markUsed]);

  const openSetlists = useCallback(() => {
    router.push('/setlists');
  }, [router]);

  // Opened as the first route, there is no history to go back to.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return (
    <MetronomeScreen
      insets={insets}
      onBack={goBack}
      onOpenSetlists={openSetlists}
    />
  );
}

export default function MetronomeRoute() {
  return (
    <ToolGate toolId={TOOL_ID.metronome}>
      <MetronomeRouteBody />
    </ToolGate>
  );
}
