import type { MicStatus, StemPlayerStatus } from '@kitbag/core-state';

export interface PracticeActivity {
  readonly metronomeRunning: boolean;
  readonly songPlaying: boolean;
  readonly tunerListening: boolean;
}

export function screenStaysOn(
  activity: PracticeActivity,
  allowed: boolean,
): boolean {
  return (
    allowed &&
    (activity.metronomeRunning ||
      activity.songPlaying ||
      activity.tunerListening)
  );
}

interface Source<T> {
  readonly getState: () => T;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface KeepAwakeDeps {
  readonly metronome: Source<{ readonly running: boolean }>;
  readonly tuner: Source<{ readonly mic: MicStatus }>;
  readonly stemPlayer: Source<{ readonly status: StemPlayerStatus }>;
  readonly setting: Source<{ readonly keepScreenAwake: boolean }>;
  readonly mixerPlaying: () => boolean;
  readonly poll: (tick: () => void) => () => void;
  readonly onForeground: (listener: () => void) => void;
  readonly setKeepScreenOn: (on: boolean) => void;
}

export function wireKeepAwake(deps: KeepAwakeDeps): void {
  let kept = false;
  let stopPolling: (() => void) | undefined;

  const songOpen = () => deps.stemPlayer.getState().status === 'ready';

  const apply = () => {
    const on = screenStaysOn(
      {
        metronomeRunning: deps.metronome.getState().running,
        songPlaying: songOpen() && deps.mixerPlaying(),
        tunerListening: deps.tuner.getState().mic === 'listening',
      },
      deps.setting.getState().keepScreenAwake,
    );
    if (on === kept) return;
    kept = on;
    deps.setKeepScreenOn(on);
  };

  // The mixer's playing flag is engine truth with no store copy: the song can end
  // or be paused from the notification, so it is polled while a song is open.
  const followSong = () => {
    if (songOpen()) {
      stopPolling ??= deps.poll(apply);
    } else {
      stopPolling?.();
      stopPolling = undefined;
    }
    apply();
  };

  // A recreated activity starts without the window flag.
  const reapply = () => {
    if (kept) deps.setKeepScreenOn(true);
  };

  deps.metronome.subscribe(apply);
  deps.tuner.subscribe(apply);
  deps.setting.subscribe(apply);
  deps.stemPlayer.subscribe(followSong);
  deps.onForeground(reapply);
  followSong();
}
