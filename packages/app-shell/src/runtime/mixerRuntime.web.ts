import { KB_RESULT } from '@kitbag/core-native';
import { UNITY_GAIN, type MixerRuntime } from '@kitbag/core-state';

const noEngine = () => Promise.resolve<number>(KB_RESULT.KB_ERROR_INTERNAL);
const ignore = () => undefined;

export const mixerRuntime: MixerRuntime = {
  commands: {
    start: noEngine,
    engineHold: noEngine,
    engineRelease: ignore,
    loadTrack: noEngine,
    mixerUnloadTrack: ignore,
    mixerSetGain: ignore,
    mixerSetMute: ignore,
    mixerSetSolo: ignore,
    mixerSetMasterGain: ignore,
    mixerMasterGain: () => Promise.resolve(UNITY_GAIN),
    mixerPlay: ignore,
    mixerPause: ignore,
    mixerStop: ignore,
    mixerSeek: ignore,
    mixerSetLoop: noEngine,
    mixerClearLoop: noEngine,
    setGrid: noEngine,
    clearGrid: ignore,
    metronomeFollowMixer: ignore,
    metronomeStart: ignore,
    metronomeStop: ignore,
    songTransportShow: ignore,
    songTransportHide: ignore,
    onSongStopped: () => ({ remove: ignore }),
  },
  sharedMetronome: { active: () => false, release: ignore },
  engine: {
    sampleRate: () => 0,
    position: () => 0,
    playing: () => false,
    nowFrame: () => 0,
  },
  readWaveform: () => Promise.reject(new Error('No waveforms on web')),
};
