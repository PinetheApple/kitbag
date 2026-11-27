import { NO_CLICK, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';

import { FALLBACK_BEATS_PER_BAR } from './barMeter.ts';
import { NO_SONG_FACTS } from './facts.ts';
import { NO_LYRICS } from './lyrics.ts';
import { UNITY_GAIN, UNSHIFTED_KEY } from './mix.ts';
import type { StemPlayerState } from './store.ts';

export const closedState: StemPlayerState = {
  status: 'idle',
  setId: null,
  title: '',
  artist: null,
  facts: NO_SONG_FACTS,
  recordedFacts: NO_SONG_FACTS,
  speed: KB_MIXER_UNITY_RATE,
  songKey: UNSHIFTED_KEY,
  stems: [],
  overLimit: 0,
  masterGain: UNITY_GAIN,
  engineRate: 0,
  durationFrames: 0,
  beats: [],
  downbeatIndices: [],
  meterOverride: NO_METER_OVERRIDE,
  detectedMeter: FALLBACK_BEATS_PER_BAR,
  detectedBarOneSeconds: 0,
  tempo: null,
  tempoMode: null,
  loop: { kind: 'off' },
  loopFailure: null,
  undoableLoop: null,
  click: false,
  ...NO_CLICK,
  countEndFrame: null,
  countBeatsPerBar: FALLBACK_BEATS_PER_BAR,
  advancedTo: null,
  advanceCountEnd: null,
  sections: [],
  lyrics: NO_LYRICS,
  retime: { kind: 'off' },
  retimeFailure: null,
  manualTempo: null,
  tempoUndoable: false,
};
