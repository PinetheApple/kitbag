import type { Debounced } from './debounce.ts';
import { clamp } from '../metronome/config.ts';
import { soloAfter, UNITY_GAIN } from './mix.ts';
import type { MixSaver } from './mixSaver.ts';
import type { StemPlayerRuntime } from './runtime.ts';
import type { Get, SetState, StemPlayerActions, StemRow } from './store.ts';
import { secondsToFrames } from './time.ts';

type RuntimeOf = () => StemPlayerRuntime;

function saveRow(saver: MixSaver, row: StemRow) {
  saver.queue({
    id: row.id,
    volume: row.volume,
    muted: row.muted,
    soloed: row.soloed,
  });
}

export function mixActions(
  set: SetState,
  get: Get,
  runtimeOf: RuntimeOf,
  saver: MixSaver,
): Pick<
  StemPlayerActions,
  'setGain' | 'toggleMute' | 'solo' | 'setMasterGain' | 'resetMix'
> {
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
      runtimeOf().commands.mixerSetGain(index, gain);
    },
    toggleMute: (index) => {
      const row = get().stems[index];
      if (row === undefined) return;
      const { commands } = runtimeOf();
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
      const { commands } = runtimeOf();
      stems.forEach((row, track) => {
        const on = soloed[track] ?? false;
        if (on === row.soloed) return;
        const unmute = on && row.muted;
        update(track, unmute ? { soloed: on, muted: false } : { soloed: on });
        if (unmute) commands.mixerSetMute(track, false);
        commands.mixerSetSolo(track, on);
      });
    },
    setMasterGain: (gain) => {
      set({ masterGain: gain });
      runtimeOf().commands.mixerSetMasterGain(gain);
    },
    resetMix: () => {
      const { commands } = runtimeOf();
      get().stems.forEach((row, track) => {
        update(track, { volume: UNITY_GAIN, muted: false, soloed: false });
        commands.mixerSetGain(track, UNITY_GAIN);
        commands.mixerSetMute(track, false);
        commands.mixerSetSolo(track, false);
      });
      set({ masterGain: UNITY_GAIN });
      commands.mixerSetMasterGain(UNITY_GAIN);
    },
  };
}

// Within this of the end, play starts the song over: the mixer stops on the
// last frame, so a press there would otherwise play nothing.
const END_SLACK_SECONDS = 0.25;

export function transportActions(
  get: Get,
  runtimeOf: RuntimeOf,
  scrubSeek: Debounced<[number]>,
): Pick<
  StemPlayerActions,
  'togglePlay' | 'scrub' | 'cancelScrub' | 'seek' | 'skip'
> {
  const seek = (frame: number) => {
    scrubSeek.cancel();
    const clamped = clamp(frame, 0, get().durationFrames);
    runtimeOf().commands.mixerSeek(clamped);
  };
  return {
    togglePlay: () => {
      const { commands, engine } = runtimeOf();
      if (engine.playing()) {
        commands.mixerPause();
        return;
      }
      const { durationFrames, engineRate } = get();
      const slack = secondsToFrames(END_SLACK_SECONDS, engineRate);
      if (engine.position() >= durationFrames - slack) seek(0);
      commands.mixerPlay();
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
