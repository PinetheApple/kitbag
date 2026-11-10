import { createStore, type StoreApi } from 'zustand/vanilla';

export interface MixerClickSource {
  readonly running: () => boolean;
  readonly title: () => string;
  readonly turnOff: () => void;
}

export interface ReleasedClick {
  readonly title: string;
  readonly id: number;
  readonly at: number;
}

export interface MixerClickNotice {
  readonly released: ReleasedClick | null;
  readonly dismiss: () => void;
}

export interface MixerClick {
  readonly attach: (source: MixerClickSource) => void;
  readonly detach: (source: MixerClickSource) => void;
  readonly active: () => boolean;
  readonly release: () => void;
  readonly notice: StoreApi<MixerClickNotice>;
}

export function createMixerClick(now: () => number = Date.now): MixerClick {
  let source: MixerClickSource | null = null;
  let releaseCount = 0;
  const notice = createStore<MixerClickNotice>((set) => ({
    released: null,
    dismiss: () => {
      set({ released: null });
    },
  }));
  const active = () => source?.running() ?? false;
  return {
    attach: (next) => {
      source = next;
    },
    detach: (previous) => {
      if (source === previous) source = null;
    },
    active,
    release: () => {
      if (source === null || !active()) return;
      const title = source.title();
      source.turnOff();
      releaseCount++;
      notice.setState({ released: { title, id: releaseCount, at: now() } });
    },
    notice,
  };
}

export const mixerClick = createMixerClick();
