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

    const applyToEngine = async (slot: number, sound: ClickSound | null) => {
      if (sound === null) deps().clear(slot);
      else await deps().load(slot, sound.fileName);
    };

    const saved = async (slot: number): Promise<ClickSoundOutcome> => {
      await refresh();
      const sound = get().sounds.find((stored) => stored.slot === slot);
      if (sound === undefined) throw new Error('Saved click sound missing');
      return { kind: 'saved', sound };
    };

    const prepared = async (sourceUri: string) => {
      const fileName = deps().freshFileName();
      const result = await deps().prepare(sourceUri, fileName);
      return { fileName, result };
    };

    const add = async (
      sourceUri: string,
      name: string,
    ): Promise<ClickSoundOutcome> => {
      const { repository, load, newUuid } = deps();
      const taken = new Set((await repository().list()).map((s) => s.slot));
      const slot = SLOTS.find((free) => !taken.has(free));
      if (slot === undefined) return { kind: 'full' };
      const { fileName, result } = await prepared(sourceUri);
      if (result !== KB_RESULT.KB_OK) return { kind: 'refused', result };
      const sound = { slot, uuid: newUuid(), name, fileName };
      const added = await repository()
        .add(sound)
        .catch(async (error: unknown) => {
          await discard(fileName);
          throw error;
        });
      if (!added) {
        await discard(fileName);
        return { kind: 'full' };
      }
      const loaded = await load(slot, fileName);
      if (loaded !== KB_RESULT.KB_OK) {
        await repository().remove(slot);
        await discard(fileName);
        return { kind: 'refused', result: loaded };
      }
      return saved(slot);
    };

    const replace = async (
      slot: number,
      sourceUri: string,
      name: string,
    ): Promise<ClickSoundOutcome> => {
      const { repository, load, newUuid } = deps();
      const { fileName, result } = await prepared(sourceUri);
      if (result !== KB_RESULT.KB_OK) return { kind: 'refused', result };
      const loaded = await load(slot, fileName);
      if (loaded !== KB_RESULT.KB_OK) {
        await discard(fileName);
        return { kind: 'refused', result: loaded };
      }
      let previous: ClickSound | null;
      try {
        previous = await repository().put({
          slot,
          uuid: newUuid(),
          name,
          fileName,
        });
      } catch (error) {
        await applyToEngine(slot, await repository().get(slot));
        await discard(fileName);
        throw error;
      }
      if (previous !== null) await discard(previous.fileName);
      return saved(slot);
    };

    const oneAtATime = async (
      work: () => Promise<ClickSoundOutcome>,
    ): Promise<ClickSoundOutcome> => {
      if (get().importing) return { kind: 'busy' };
      set({ importing: true });
      try {
        return await work();
      } finally {
        set({ importing: false });
      }
    };

    return {
      sounds: [],
      importing: false,
      sync: async () => {
        const sounds = await deps().repository().list();
        for (const slot of SLOTS)
          await applyToEngine(
            slot,
            sounds.find((sound) => sound.slot === slot) ?? null,
          );
        set({ sounds });
      },
      importSound: (sourceUri, name) => oneAtATime(() => add(sourceUri, name)),
      replace: (slot, sourceUri, name) =>
        oneAtATime(() => replace(slot, sourceUri, name)),
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
