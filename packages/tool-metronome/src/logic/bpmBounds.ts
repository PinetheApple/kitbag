// The shape core-state's BPM_BOUNDS arrives in. Declared here, not in each
// module that takes it, so the gesture and the numpad share one contract; the
// VALUES stay core-state's (§13.7). The logic modules take it as an argument
// rather than importing the core-state barrel, which pulls react-native and
// would end their headless testability.
export interface BpmBounds {
  readonly min: number;
  readonly max: number;
}
