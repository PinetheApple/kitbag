import { useLastTool } from '@kitbag/core-state';
import { MetronomeScreen } from '@kitbag/tool-metronome';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';

// Route for the metronome performance surface (SPEC §5.2, #46). The tool owns
// the screen; the shell only mounts it (§9.4) until the plugin registry lands.
// The shell, not the tool, records the visit for Home's Continue card.
export default function MetronomeRoute() {
  const insets = useSafeAreaInsets();
  const markUsed = useLastTool((s) => s.markUsed);

  useEffect(() => {
    markUsed(TOOL_ID.metronome);
  }, [markUsed]);

  return <MetronomeScreen insets={insets} />;
}
