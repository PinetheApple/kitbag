import type { ClickSound } from '@kitbag/core-db';
import {
  customSoundId,
  KB_CUSTOM_SOUND_SLOTS,
  KB_RESULT,
} from '@kitbag/core-native';
import { createStore } from 'zustand/vanilla';

import { getClickSounds, type ClickSoundDeps } from './runtime.ts';

export type ClickSoundOutcome =
  | { readonly kind: 'saved'; readonly sound: ClickSound }
  | { readonly kind: 'refused'; readonly result: number }
  | { readonly kind: 'full' }
  | { readonly kind: 'busy' };

export interface ClickSoundState {
  readonly sounds: readonly ClickSound[];
  readonly importing: boolean;
}

export interface ClickSoundActions {
  sync: () => Promise<void>;
  importSound: (sourceUri: string, name: string) => Promise<ClickSoundOutcome>;
  replace: (
    slot: number,
    sourceUri: string,
    name: string,
  ) => Promise<ClickSoundOutcome>;
  rename: (slot: number, name: string) => Promise<void>;
  remove: (slot: number) => Promise<number>;
}

export type ClickSoundStore = ClickSoundState & ClickSoundActions;

const SLOTS = Array.from({ length: KB_CUSTOM_SOUND_SLOTS }, (_, slot) => slot);

export function createClickSoundStore(
  deps: () => ClickSoundDeps = getClickSounds,
) {
  return createStore<ClickSoundStore>()((set, get) => {
    const refresh = async () => {
      set({ sounds: await deps().repository().list() });
    };

    const discard = async (fileName: string) => {
      await deps()
        .deleteFile(fileName)
        .catch(() => undefined);
    };

    const restoreEngine = async (slot: number) => {
      const previous = get().sounds.find((sound) => sound.slot === slot);
      if (previous === undefined) deps().clear(slot);
      else await deps().load(slot, previous.fileName);
    };

    const save = async (
      slot: number,
      sourceUri: string,
      name: string,
    ): Promise<ClickSoundOutcome> => {
      const { prepare, load, repository, newUuid, freshFileName } = deps();
      const fileName = freshFileName();
      const prepared = await prepare(sourceUri, fileName);
      if (prepared !== KB_RESULT.KB_OK)
        return { kind: 'refused', result: prepared };
      const loaded = await load(slot, fileName);
      if (loaded !== KB_RESULT.KB_OK) {
        await discard(fileName);
        return { kind: 'refused', result: loaded };
      }
      const sound = { slot, uuid: newUuid(), name, fileName };
      let previous: ClickSound | null;
      try {
        previous = await repository().put(sound);
      } catch (error) {
        await restoreEngine(slot);
        await discard(fileName);
        throw error;
      }
      if (previous !== null) await discard(previous.fileName);
      await refresh();
      const saved = get().sounds.find((stored) => stored.slot === slot);
      return { kind: 'saved', sound: saved ?? sound };
    };

    const guarded = async (
      slot: number | undefined,
      sourceUri: string,
      name: string,
    ): Promise<ClickSoundOutcome> => {
      if (get().importing) return { kind: 'busy' };
      if (slot === undefined) return { kind: 'full' };
      set({ importing: true });
      try {
        return await save(slot, sourceUri, name);
      } finally {
        set({ importing: false });
      }
    };

    const freeSlot = () => {
      const taken = new Set(get().sounds.map(({ slot }) => slot));
      return SLOTS.find((slot) => !taken.has(slot));
    };

    return {
      sounds: [],
      importing: false,
      sync: async () => {
        const sounds = await deps().repository().list();
        for (const slot of SLOTS) {
          const sound = sounds.find((row) => row.slot === slot);
          if (sound === undefined) deps().clear(slot);
          else await deps().load(slot, sound.fileName);
        }
        set({ sounds });
      },
      importSound: (sourceUri, name) => guarded(freeSlot(), sourceUri, name),
      replace: (slot, sourceUri, name) => guarded(slot, sourceUri, name),
      rename: async (slot, name) => {
        await deps().repository().rename(slot, name);
        await refresh();
      },
      remove: async (slot) => {
        const { removed, songsReset } = await deps().repository().remove(slot);
        deps().clear(slot);
        if (removed !== null) await discard(removed.fileName);
        await refresh();
        await deps().afterRemove(customSoundId(slot));
        return songsReset;
      },
    };
  });
}

export const clickSoundStore = createClickSoundStore();
