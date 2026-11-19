import type { ClickSound } from '@kitbag/core-db';
import {
  type PickedDocument,
  customSoundId,
  KB_CUSTOM_SOUND_SLOTS,
  KB_RESULT,
} from '@kitbag/core-native';
import { createStore } from 'zustand/vanilla';

import { checkAudioFormat } from '../songLibrary/logic.ts';
import {
  problemOf,
  soundNameFromFile,
  type ClickSoundNotice,
  type ClickSoundProblem,
} from './notices.ts';
import { clickSoundLock, type ClickSoundLock } from './lock.ts';
import { getClickSounds, type ClickSoundDeps } from './runtime.ts';

export type ClickSoundOutcome =
  | { readonly kind: 'saved'; readonly sound: ClickSound }
  | { readonly kind: 'refused'; readonly result: number }
  | { readonly kind: 'full' }
  | { readonly kind: 'busy' };

export interface ClickSoundState {
  readonly sounds: readonly ClickSound[];
  readonly importing: boolean;
  readonly unavailable: readonly number[];
  readonly preparing: string | null;
  readonly notice: ClickSoundNotice | null;
  readonly formats: readonly string[];
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
  importPicked: (replacing: ClickSound | null) => Promise<ClickSound | null>;
  dismissNotice: () => void;
  sweepOrphans: () => Promise<void>;
}

export type ClickSoundStore = ClickSoundState & ClickSoundActions;

const SLOTS = Array.from({ length: KB_CUSTOM_SOUND_SLOTS }, (_, slot) => slot);

function warn(what: string, error: unknown) {
  console.warn(`[kitbag] ${what}`, error);
}

export function createClickSoundStore(
  deps: () => ClickSoundDeps = getClickSounds,
  lock: ClickSoundLock = clickSoundLock,
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

    const applyToEngine = async (
      slot: number,
      sound: ClickSound | null,
    ): Promise<boolean> => {
      if (sound === null) {
        deps().clear(slot);
        return true;
      }
      const result = await deps()
        .load(slot, sound.fileName)
        .catch((error: unknown) => {
          warn(`loading click sound ${sound.fileName} failed`, error);
          return KB_RESULT.KB_ERROR_INTERNAL;
        });
      if (result === KB_RESULT.KB_OK) return true;
      deps().clear(slot);
      return false;
    };

    const available = (slot: number) => {
      set({ unavailable: get().unavailable.filter((gone) => gone !== slot) });
    };

    const saved = async (slot: number): Promise<ClickSoundOutcome> => {
      await refresh();
      available(slot);
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
        return await lock.run(work);
      } finally {
        set({ importing: false });
      }
    };

    const sweep = async () => {
      const { listFiles, repository } = deps();
      const files = await listFiles();
      const named = new Set((await repository().list()).map((s) => s.fileName));
      for (const file of files) if (!named.has(file)) await discard(file);
    };

    const formats = () => {
      try {
        return deps().constants().supportedAudioFamilies;
      } catch (error) {
        warn('library constants unavailable', error);
        return [];
      }
    };

    let picking = false;
    const pickDocument = async () => {
      set({ notice: null });
      try {
        return await deps().pickDocument();
      } catch (error) {
        warn('picker failed', error);
        set({ notice: { kind: 'picker' } });
        return null;
      }
    };

    const prepareDocument = async (
      doc: PickedDocument,
      replacing: ClickSound | null,
    ): Promise<ClickSoundOutcome | ClickSoundProblem> => {
      const codes = deps().constants();
      const check = checkAudioFormat(doc, codes);
      if (!check.supported)
        return {
          kind: 'format',
          format: check.format,
          supported: codes.supportedAudioFamilies,
        };
      const name = soundNameFromFile(doc.name);
      set({ preparing: doc.name });
      try {
        return await oneAtATime(() =>
          replacing === null
            ? add(doc.uri, name)
            : replace(replacing.slot, doc.uri, name),
        );
      } finally {
        set({ preparing: null });
      }
    };

    const importDocument = async (
      doc: PickedDocument,
      replacing: ClickSound | null,
    ): Promise<ClickSound | null> => {
      let outcome: ClickSoundOutcome | ClickSoundProblem;
      try {
        outcome = await prepareDocument(doc, replacing);
      } catch (error) {
        warn(`importing click sound ${doc.name} failed`, error);
        outcome = { kind: 'failed' };
      }
      if (outcome.kind === 'saved') return outcome.sound;
      if (outcome.kind === 'full' || outcome.kind === 'busy') return null;
      const problem =
        outcome.kind === 'refused' ? problemOf(outcome.result) : outcome;
      set({
        notice: {
          kind: 'refused',
          fileName: doc.name,
          replacing: replacing?.name ?? null,
          problem,
        },
      });
      return null;
    };

    return {
      sounds: [],
      importing: false,
      unavailable: [],
      preparing: null,
      notice: null,
      formats: [],
      sync: () =>
        lock.run(async () => {
          const sounds = await deps().repository().list();
          const unavailable: number[] = [];
          for (const slot of SLOTS) {
            const sound = sounds.find((stored) => stored.slot === slot) ?? null;
            if (!(await applyToEngine(slot, sound))) unavailable.push(slot);
          }
          set({ sounds, unavailable, formats: formats() });
        }),
      importSound: (sourceUri, name) => oneAtATime(() => add(sourceUri, name)),
      replace: (slot, sourceUri, name) =>
        oneAtATime(() => replace(slot, sourceUri, name)),
      rename: (slot, name) =>
        lock.run(async () => {
          await deps().repository().rename(slot, name);
          await refresh();
        }),
      remove: async (slot) => {
        const songsReset = await lock.run(async () => {
          const removal = await deps().repository().remove(slot);
          deps().clear(slot);
          if (removal.removed !== null) await discard(removal.removed.fileName);
          available(slot);
          await refresh();
          return removal.songsReset;
        });
        await deps().afterRemove(customSoundId(slot));
        return songsReset;
      },
      importPicked: async (replacing) => {
        if (picking || get().importing) return null;
        picking = true;
        try {
          const doc = await pickDocument();
          return doc === null ? null : await importDocument(doc, replacing);
        } finally {
          picking = false;
        }
      },
      dismissNotice: () => {
        set({ notice: null });
      },
      sweepOrphans: () =>
        lock.run(async () => {
          await deps().clearPartials();
          await sweep();
        }),
    };
  });
}

export const clickSoundStore = createClickSoundStore();
