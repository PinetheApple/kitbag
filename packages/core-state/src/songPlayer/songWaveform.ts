import type { SongPlayerRuntime } from './runtime.ts';
import type { SongPlayerState } from './state.ts';

interface SongWaveformContext {
  readonly set: (change: Pick<SongPlayerState, 'envelope'>) => void;
  readonly runtimeOf: () => Pick<SongPlayerRuntime, 'readWaveform'>;
  readonly live: (opened: number) => boolean;
}

export function songWaveform({ set, runtimeOf, live }: SongWaveformContext) {
  let bars = 0;
  let shown: string | null = null;
  let latest: string | null = null;
  return {
    reset: (nextBars: number) => {
      bars = nextBars;
      shown = null;
      latest = null;
    },
    show: (opened: number, path: string | null) => {
      if (path === null || path === shown || path === latest) return;
      latest = path;
      runtimeOf()
        .readWaveform(path, bars)
        .then((envelope) => {
          if (!live(opened) || path !== latest) return;
          shown = path;
          set({ envelope });
        })
        .catch((error: unknown) => {
          if (path === latest) latest = null;
          console.warn('[kitbag] song waveform unreadable', error);
        });
    },
  };
}
