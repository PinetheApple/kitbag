import { createStore, type StoreApi } from 'zustand/vanilla';

export interface MixerClickSource {
  readonly running: () => boolean;
  readonly title: () => string;
  readonly turnOff: () => void;
}

export interface ReleasedClick {
  readonly title: string;
  readonly release: number;
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

export type MixerClickRelease = Pick<MixerClick, 'active' | 'release'>;

export function createMixerClick(): MixerClick {
  let source: MixerClickSource | null = null;
  let releases = 0;
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
      releases++;
      notice.setState({ released: { title, release: releases } });
    },
    notice,
  };
}

export const mixerClick = createMixerClick();
