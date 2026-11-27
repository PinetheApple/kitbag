import {
  KB_STOPPED_BEAT,
  KITBAG_HOST_OBJECT_KEY,
  type HostGlobal,
} from './KitbagHostObject.ts';

const STOPPED_BAR_PHASE = 0;
const STOPPED_BPM = 0;

function installedTransport(): HostGlobal[typeof KITBAG_HOST_OBJECT_KEY] {
  'worklet';
  return (globalThis as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
}

export function readBarPhase(): number {
  'worklet';
  return installedTransport()?.bar_phase ?? STOPPED_BAR_PHASE;
}

export function readCurrentBeat(): number {
  'worklet';
  return installedTransport()?.current_beat ?? KB_STOPPED_BEAT;
}

export function readCurrentBpm(): number {
  'worklet';
  return installedTransport()?.current_bpm ?? STOPPED_BPM;
}
