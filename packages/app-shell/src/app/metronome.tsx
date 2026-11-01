import { useLastTool } from '@kitbag/core-state';
import { MetronomeScreen } from '@kitbag/tool-metronome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useBackOrHome } from '@/runtime/backOrHome';

// The shell, not the tool, records the visit for Home's Continue card.
function MetronomeRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const markUsed = useLastTool((s) => s.markUsed);

  useEffect(() => {
    markUsed(TOOL_ID.metronome);
  }, [markUsed]);

  const openSetlists = useCallback(() => {
    router.push('/setlists');
  }, [router]);

  const goBack = useBackOrHome();

  return (
    <MetronomeScreen
      insets={insets}
      onBack={goBack}
      onOpenSetlists={openSetlists}
    />
  );
}

export default gated(TOOL_ID.metronome, MetronomeRoute);
