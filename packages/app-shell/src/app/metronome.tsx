import { MetronomeScreen } from '@kitbag/tool-metronome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Route for the metronome performance surface (SPEC §5.2, #46). The tool owns
// the screen; the shell only mounts it (§9.4) until the plugin registry lands.
export default function MetronomeRoute() {
  const insets = useSafeAreaInsets();

  return <MetronomeScreen insets={insets} />;
}
