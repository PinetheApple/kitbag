import type { ToolHost, ToolPlugin } from '@kitbag/core-plugin-api';
import { StyleSheet, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { SAMPLE_ROUTE } from './routes';

const styles = StyleSheet.create({ root: { flex: 1 } });

export function register(host: ToolHost): ToolPlugin {
  function SampleScreen() {
    const phase = useSharedValue(0);
    useFrameCallback(() => {
      phase.value = host.engine.reads.barPhase();
    });
    return <View style={styles.root} />;
  }
  return {
    id: 'sample',
    name: 'Sample',
    icon: 'metronome',
    routes: [{ path: SAMPLE_ROUTE, screen: SampleScreen }],
  };
}
