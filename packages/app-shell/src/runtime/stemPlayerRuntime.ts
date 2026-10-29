import {
  getKitbagCommands,
  getKitbagHostObject,
  getKitbagLibrary,
} from '@kitbag/core-native';
import {
  configureStemPlayer,
  type StemPlayerCommands,
} from '@kitbag/core-state';

import { getDatabase } from './database.ts';
import { metronomeTransport } from './transportRuntime.ts';

// Resolved per call: the TurboModule throws in a build without it, and this
// file loads with the root layout.
const commands: StemPlayerCommands = {
  start: () => getKitbagCommands().start(),
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
  mixerSetLoop: (start, end) => getKitbagCommands().mixerSetLoop(start, end),
  mixerClearLoop: () => getKitbagCommands().mixerClearLoop(),
  setGrid: (beats, anchor) => getKitbagCommands().setGrid(beats, anchor),
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
};

configureStemPlayer({
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
  records: {
    readStemSet: (id) => getDatabase().songLibrary.readStemSet(id),
    saveStemMix: (mixes) => getDatabase().songLibrary.saveStemMix(mixes),
  },
  readWaveform: (path, buckets) =>
    getKitbagLibrary().readWaveform(path, buckets),
});
