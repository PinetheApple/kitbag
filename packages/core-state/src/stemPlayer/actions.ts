import type { Debounced } from '../debounce.ts';
import { clamp } from '../metronome/config.ts';
import { soloAfter, UNITY_GAIN } from './mix.ts';
import type { MixSaver } from './mixSaver.ts';
import { mixerSeeked } from './mixerSeeked.ts';
import type { MixerRuntime, StemPlayerCommands } from './runtime.ts';
import type { SongStart } from './songStart.ts';
import { songStarting } from './songStarting.ts';
import {
  restartFromFrame,
  songTransportShown,
  type SongCardOwner,
} from './songTransport.ts';
import type { StemPlayerActions, StemPlayerState, StemRow } from './store.ts';
import { secondsToFrames } from './time.ts';

type MixSlice = Pick<StemPlayerState, 'stems' | 'masterGain'>;

type MixSet = (
  change: Partial<MixSlice> | ((state: MixSlice) => Partial<MixSlice>),
) => void;

export type StemMixCommands = Pick<
  StemPlayerCommands,
  'mixerSetGain' | 'mixerSetMute' | 'mixerSetSolo'
>;

type MixCommands = StemMixCommands &
  Pick<StemPlayerCommands, 'mixerSetMasterGain'>;

function saveRow(saver: MixSaver, row: StemRow) {
  saver.queue({
    id: row.id,
    volume: row.volume,
    muted: row.muted,
    soloed: row.soloed,
  });
}

export function stemMixActions(
  set: MixSet,
  get: () => MixSlice,
  commandsOf: () => StemMixCommands,
  saver: MixSaver,
): Pick<StemPlayerActions, 'setGain' | 'toggleMute' | 'solo' | 'resetMix'> {
  const update = (index: number, change: Partial<StemRow>) => {
    const row = get().stems[index];
    if (row === undefined) return undefined;
    const next = { ...row, ...change };
    set((s) => ({ stems: s.stems.map((r, i) => (i === index ? next : r)) }));
    saveRow(saver, next);
    return next;
  };
  return {
    setGain: (index, gain) => {
      if (update(index, { volume: gain }) === undefined) return;
      commandsOf().mixerSetGain(index, gain);
    },
    toggleMute: (index) => {
      const row = get().stems[index];
      if (row === undefined) return;
      const commands = commandsOf();
      const muted = !row.muted;
      const unsolo = muted && row.soloed;
      update(index, unsolo ? { muted, soloed: false } : { muted });
      if (unsolo) commands.mixerSetSolo(index, false);
      commands.mixerSetMute(index, muted);
    },
    solo: (index, additive) => {
      const { stems } = get();
      if (stems[index] === undefined) return;
      const soloed = soloAfter(
        stems.map((row) => row.soloed),
        index,
        additive,
      );
      const commands = commandsOf();
      stems.forEach((row, track) => {
        const on = soloed[track] ?? false;
        if (on === row.soloed) return;
        const unmute = on && row.muted;
        update(track, unmute ? { soloed: on, muted: false } : { soloed: on });
        if (unmute) commands.mixerSetMute(track, false);
        commands.mixerSetSolo(track, on);
      });
    },
    resetMix: () => {
      const commands = commandsOf();
      get().stems.forEach((row, track) => {
        update(track, { volume: UNITY_GAIN, muted: false, soloed: false });
        commands.mixerSetGain(track, UNITY_GAIN);
        commands.mixerSetMute(track, false);
        commands.mixerSetSolo(track, false);
      });
    },
  };
}

export function mixActions(
  set: MixSet,
  get: () => MixSlice,
  commandsOf: () => MixCommands,
  saver: MixSaver,
): Pick<
  StemPlayerActions,
  'setGain' | 'toggleMute' | 'solo' | 'setMasterGain' | 'resetMix'
> {
  const stems = stemMixActions(set, get, commandsOf, saver);
  const setMasterGain = (gain: number) => {
    set({ masterGain: gain });
    commandsOf().mixerSetMasterGain(gain);
  };
  return {
    ...stems,
    setMasterGain,
    resetMix: () => {
      stems.resetMix();
      setMasterGain(UNITY_GAIN);
    },
  };
}

export interface SoundingPause {
  readonly pauseIfSounding: () => boolean;
}

export type TransportSlice = Pick<
  StemPlayerState,
  'title' | 'artist' | 'durationFrames' | 'engineRate' | 'status'
>;

export function plainStart(
  runtimeOf: () => MixerRuntime,
): Pick<SongStart, 'play' | 'cancel'> {
  return {
    play: () => {
      songStarting();
      runtimeOf().commands.mixerPlay();
    },
    cancel: () => false,
  };
}

export function transportActions(
  get: () => TransportSlice,
  runtimeOf: () => MixerRuntime,
  card: () => SongCardOwner,
  scrubSeek: Debounced<[number]>,
  afterSeek?: (frame: number) => void,
  start: Pick<SongStart, 'play' | 'cancel'> = plainStart(runtimeOf),
): Pick<
  StemPlayerActions,
  | 'togglePlay'
  | 'playFrom'
  | 'pauseIfSounding'
  | 'scrub'
  | 'cancelScrub'
  | 'seek'
  | 'skip'
> {
  const seek = (frame: number) => {
    scrubSeek.cancel();
    const clamped = clamp(frame, 0, get().durationFrames);
    runtimeOf().commands.mixerSeek(clamped);
    mixerSeeked();
    afterSeek?.(clamped);
  };
  const playFrom = (frame: number) => {
    const { durationFrames, engineRate, status } = get();
    if (status !== 'ready') return;
    let head = frame;
    if (head >= restartFromFrame(durationFrames, engineRate)) {
      head = 0;
      seek(head);
    }
    start.play(head);
    runtimeOf().commands.songTransportShow(songTransportShown(get(), card()));
  };
  return {
    togglePlay: () => {
      const { commands, engine } = runtimeOf();
      if (engine.playing()) {
        commands.mixerPause();
        return;
      }
      if (start.cancel()) return;
      playFrom(engine.position());
    },
    playFrom,
    pauseIfSounding: () => {
      const { commands, engine } = runtimeOf();
      if (!engine.playing()) return start.cancel();
      commands.mixerPause();
      return true;
    },
    scrub: (frame) => {
      scrubSeek(frame);
    },
    cancelScrub: () => {
      scrubSeek.cancel();
    },
    seek,
    skip: (seconds) => {
      seek(
        runtimeOf().engine.position() +
          secondsToFrames(seconds, get().engineRate),
      );
    },
  };
}
