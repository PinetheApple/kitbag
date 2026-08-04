import { MetronomeScreen } from '@kitbag/tool-metronome';

// Route for the metronome performance surface (SPEC §5.2, #46). The tool owns
// the screen; the shell only mounts it (§9.4) until the plugin registry lands.
export default function MetronomeRoute() {
  return <MetronomeScreen />;
}
