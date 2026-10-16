import { type KitbagCommandsSpec } from '@kitbag/core-native';

import { getMetronomeRuntime } from './runtime.ts';

export type MetronomeCommands = Pick<
  KitbagCommandsSpec,
  | 'start'
  | 'metronomeStart'
  | 'metronomeStop'
  | 'metronomePause'
  | 'setTempo'
  | 'setBeats'
  | 'setSubdivision'
  | 'setAccent'
  | 'setPoly'
  | 'setPolyAccent'
  | 'setSounds'
  | 'previewSound'
  | 'setCountIn'
  | 'setVolume'
  | 'setLatencyOffset'
  | 'setRamp'
  | 'setBarMute'
>;

export type NowFrame = () => number;
export type EngineBpm = () => number;

export const defaultCommands: MetronomeCommands = {
  start: (...args) => getMetronomeRuntime().commands.start(...args),
  metronomeStart: (...args) => {
    getMetronomeRuntime().commands.metronomeStart(...args);
  },
  metronomeStop: (...args) => {
    getMetronomeRuntime().commands.metronomeStop(...args);
  },
  metronomePause: (...args) => {
    getMetronomeRuntime().commands.metronomePause(...args);
  },
  setTempo: (...args) => {
    getMetronomeRuntime().commands.setTempo(...args);
  },
  setBeats: (...args) => {
    getMetronomeRuntime().commands.setBeats(...args);
  },
  setSubdivision: (...args) => {
    getMetronomeRuntime().commands.setSubdivision(...args);
  },
  setAccent: (...args) => {
    getMetronomeRuntime().commands.setAccent(...args);
  },
  setPoly: (...args) => {
    getMetronomeRuntime().commands.setPoly(...args);
  },
  setPolyAccent: (...args) => {
    getMetronomeRuntime().commands.setPolyAccent(...args);
  },
  setSounds: (...args) => {
    getMetronomeRuntime().commands.setSounds(...args);
  },
  previewSound: (...args) => {
    getMetronomeRuntime().commands.previewSound(...args);
  },
  setCountIn: (...args) => {
    getMetronomeRuntime().commands.setCountIn(...args);
  },
  setVolume: (...args) => {
    getMetronomeRuntime().commands.setVolume(...args);
  },
  setLatencyOffset: (...args) => {
    getMetronomeRuntime().commands.setLatencyOffset(...args);
  },
  setRamp: (...args) => {
    getMetronomeRuntime().commands.setRamp(...args);
  },
  setBarMute: (...args) => {
    getMetronomeRuntime().commands.setBarMute(...args);
  },
};

export const defaultNowFrame: NowFrame = () => getMetronomeRuntime().nowFrame();

export const defaultEngineBpm: EngineBpm = () =>
  getMetronomeRuntime().engineBpm();
