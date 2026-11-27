import {
  KB_STOPPED_BEAT,
  KITBAG_HOST_OBJECT_KEY,
  type KitbagHostObject,
} from './KitbagHostObject.ts';

type HostGlobal = Partial<
  Record<typeof KITBAG_HOST_OBJECT_KEY, KitbagHostObject>
>;

const STOPPED_BAR_PHASE = 0;
const STOPPED_BPM = 0;

export function readBarPhase(): number {
  'worklet';
  const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
  return host?.bar_phase ?? STOPPED_BAR_PHASE;
}

export function readCurrentBeat(): number {
  'worklet';
  const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
  return host?.current_beat ?? KB_STOPPED_BEAT;
}

export function readCurrentBpm(): number {
  'worklet';
  const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
  return host?.current_bpm ?? STOPPED_BPM;
}
