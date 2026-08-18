// tool-metronome — plugin (SPEC §13.1). May import core-* only, never another
// tool, never app-shell.
//
// M3 (#46): the performance surface, SPEC §5.2. The plugin descriptor (§9.1)
// lands with the registry wave; the shell mounts the screen directly until then.
export { MetronomeScreen } from './screen/MetronomeScreen.tsx';
