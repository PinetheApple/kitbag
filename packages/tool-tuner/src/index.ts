// tool-tuner — plugin (SPEC §13.1). May import core-* only, never another
// tool, never app-shell.
//
// #118: the tuner screen, SPEC §10.2. As with the metronome, the plugin
// descriptor (§9.1) lands with the registry wave; the shell mounts the screen
// and drives the store's enter/leave until then.
export { TunerScreen, type TunerScreenProps } from './screen/TunerScreen.tsx';
export { type A4Range } from './logic/a4.ts';
export { DEFAULT_TUNING, tuningLabel } from './logic/tunings.ts';
