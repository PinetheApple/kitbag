import { KB_TUNER_A4_HZ } from '@kitbag/core-native';
import { useLastTool, tunerStore } from '@kitbag/core-state';
import { DEFAULT_TUNING, TunerScreen } from '@kitbag/tool-tuner';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';

// Route for the tuner (SPEC §10.2, #118). The tool owns the screen; the shell
// owns when the mic may run: focus enters the store (permission, config, start)
// and blur leaves it (stop). A pushed route over the tuner blurs it, so the mic
// is never left capturing behind another screen.
export default function TunerRoute() {
  const insets = useSafeAreaInsets();
  const markUsed = useLastTool((s) => s.markUsed);

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

  return <TunerScreen insets={insets} a4Range={KB_TUNER_A4_HZ} />;
}
