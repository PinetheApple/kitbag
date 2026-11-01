import { KB_TUNER_A4_HZ } from '@kitbag/core-native';
import { useLastTool, tunerStore } from '@kitbag/core-state';
import { DEFAULT_TUNING, TunerScreen } from '@kitbag/tool-tuner';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useBackOrHome } from '@/runtime/backOrHome';

// The mic runs only while focused: a route pushed over the tuner blurs it, so
// capture never continues behind another screen.
function TunerRoute() {
  const insets = useSafeAreaInsets();
  const markUsed = useLastTool((s) => s.markUsed);
  const goBack = useBackOrHome();

  useEffect(() => {
    markUsed(TOOL_ID.tuner);
  }, [markUsed]);

  useFocusEffect(
    useCallback(() => {
      tunerStore.getState().enter(DEFAULT_TUNING);
      return () => {
        tunerStore.getState().leave();
      };
    }, []),
  );

  return (
    <TunerScreen insets={insets} a4Range={KB_TUNER_A4_HZ} onBack={goBack} />
  );
}

export default gated(TOOL_ID.tuner, TunerRoute);
