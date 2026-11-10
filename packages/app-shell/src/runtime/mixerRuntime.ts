import {
  getKitbagCommands,
  getKitbagHostObject,
  getKitbagLibrary,
  setTrackKey,
} from '@kitbag/core-native';
import type { MixerRuntime, StemPlayerCommands } from '@kitbag/core-state';

import { askForNotificationsOnce } from './notificationPermission.ts';
import { metronomeTransport } from './transportRuntime.ts';

// Resolved per call: the TurboModule throws in a build without it, and this
// file loads with the root layout.
const commands: StemPlayerCommands = {
  start: () => getKitbagCommands().start(),
  engineHold: () => getKitbagCommands().engineHold(),
  engineRelease: () => {
    getKitbagCommands().engineRelease();
  },
  loadTrack: (track, relativePath) =>
    getKitbagCommands().loadTrack(track, relativePath),
  mixerUnloadTrack: (track) => {
    getKitbagCommands().mixerUnloadTrack(track);
  },
  mixerSetGain: (track, gain) => {
    getKitbagCommands().mixerSetGain(track, gain);
  },
  mixerSetMute: (track, muted) => {
    getKitbagCommands().mixerSetMute(track, muted);
  },
  mixerSetSolo: (track, soloed) => {
    getKitbagCommands().mixerSetSolo(track, soloed);
  },
  mixerSetMasterGain: (gain) => {
    getKitbagCommands().mixerSetMasterGain(gain);
  },
  mixerMasterGain: () => getKitbagCommands().mixerMasterGain(),
  mixerPlay: () => {
    getKitbagCommands().mixerPlay();
  },
  mixerPause: () => {
    getKitbagCommands().mixerPause();
  },
  mixerStop: () => {
    getKitbagCommands().mixerStop();
  },
  mixerSeek: (frame) => {
    getKitbagCommands().mixerSeek(frame);
  },
  songCountIn: (endFrame, beatFrames, beatsPerBar) =>
    getKitbagCommands().songCountIn(endFrame, beatFrames, beatsPerBar),
  songPause: () => {
    getKitbagCommands().songPause();
  },
  songStop: () => {
    getKitbagCommands().songStop();
  },
  mixerSetLoop: (start, end) => getKitbagCommands().mixerSetLoop(start, end),
  mixerClearLoop: () => getKitbagCommands().mixerClearLoop(),
  mixerSetRate: (rate) => getKitbagCommands().mixerSetRate(rate),
  mixerRate: () => getKitbagCommands().mixerRate(),
  mixerSetTrackPitch: (track, semitones) =>
    setTrackKey(getKitbagCommands(), track, semitones),
  mixerTrackPitch: (track) => getKitbagCommands().mixerTrackPitch(track),
  mixerTrackFrames: (track) => getKitbagCommands().mixerTrackFrames(track),
  setGrid: (beats, downbeats, anchor) =>
    getKitbagCommands().setGrid(beats, downbeats, anchor),
  clearGrid: () => {
    getKitbagCommands().clearGrid();
  },
  metronomeFollowMixer: (enabled) => {
    getKitbagCommands().metronomeFollowMixer(enabled);
  },
  metronomeStart: (anchor) => {
    getKitbagCommands().metronomeStart(anchor);
  },
  metronomeStop: () => {
    getKitbagCommands().metronomeStop();
  },
  songTransportShow: (state) => {
    askForNotificationsOnce();
    getKitbagCommands().songTransportShow(state);
  },
  songTransportHide: () => {
    getKitbagCommands().songTransportHide();
  },
  onSongStopped: (handler) => getKitbagCommands().onSongStopped(handler),
};

export const mixerRuntime: MixerRuntime = {
  commands,
  sharedMetronome: {
    active: metronomeTransport.active,
    release: metronomeTransport.release,
  },
  engine: {
    sampleRate: () => getKitbagHostObject().engine_sample_rate,
    position: () => getKitbagHostObject().mixer_position,
    playing: () => getKitbagHostObject().mixer_playing !== 0,
    nowFrame: () => getKitbagHostObject().frames_rendered,
  },
  readWaveform: (path, buckets) =>
    getKitbagLibrary().readWaveform(path, buckets),
};
