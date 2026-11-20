import type {
  DataFolderCodes,
  DataFolderVolume,
  DataFolderVolumes,
  MoveFinished,
  MoveStatus,
} from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { songPlayerStore } from '../songPlayer/store.ts';
import { getSongLibrary } from '../songLibrary/runtime.ts';
import { errorCode } from '../songLibrary/stemBundleLogic.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import type { StoredRowFiles } from '../storage/missingRows.ts';
import { storedRowFiles } from '../storage/storedRowFiles.ts';
import { awayPaths } from './awayPaths.ts';
import { moveSettled } from './outcomes.ts';
import {
  oldRootReleased,
  playerTracks,
  stillHolding,
  type PlayerTracks,
} from './release.ts';
import { getDataFolder, type DataFolderNative } from './runtime.ts';

export interface DataFolderState {
  readonly codes: DataFolderCodes | null;
  readonly volumes: DataFolderVolumes | null;
  readonly move: MoveStatus | null;
  readonly finished: MoveFinished | null;
  readonly error: string | null;
  readonly holders: PlayerTracks | null;
  readonly released: boolean;
  readonly pending: boolean;
  readonly declined: readonly string[];
}

export interface DataFolderActions {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly refreshVolumes: () => Promise<void>;
  readonly refreshMove: () => Promise<void>;
  readonly startMove: (volumeUuid: string | null) => Promise<boolean>;
  readonly returnCard: (volumeUuid: string) => Promise<boolean>;
  readonly cancelMove: () => Promise<boolean>;
  readonly resumeMove: () => Promise<boolean>;
  readonly undoMove: () => Promise<boolean>;
  readonly switchToInternalStorage: () => Promise<boolean>;
  readonly dismissError: () => void;
  readonly declineReturn: (volumeUuid: string) => void;
}

export type DataFolderStore = DataFolderState & DataFolderActions;

export interface PlayerWatch {
  readonly tracks: () => PlayerTracks;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface DataFolderDeps {
  readonly native: () => DataFolderNative;
  readonly storedFiles: () => Promise<readonly StoredRowFiles[]>;
  readonly players: PlayerWatch;
}

const currentTracks = () =>
  playerTracks(songPlayerStore.getState(), stemPlayerStore.getState());

const defaultDeps: DataFolderDeps = {
  native: getDataFolder,
  storedFiles: () => storedRowFiles(getSongLibrary().records),
  players: {
    tracks: currentTracks,
    subscribe: (listener) => {
      const stopSong = songPlayerStore.subscribe(listener);
      const stopStems = stemPlayerStore.subscribe(listener);
      return () => {
        stopSong();
        stopStems();
      };
    },
  },
};

const INITIAL: DataFolderState = {
  codes: null,
  volumes: null,
  move: null,
  finished: null,
  error: null,
  holders: null,
  released: false,
  pending: false,
  declined: [],
};

export function pausedMove(state: DataFolderState): MoveStatus | null {
  const { move } = state;
  return move?.paused === true && move.error === null ? move : null;
}

export function returnedCards(
  state: DataFolderState,
): readonly DataFolderVolume[] {
  const { codes, volumes, move, pending } = state;
  const busy = move !== null || pending || folderUnavailable(state);
  if (codes === null || volumes === null || busy) return [];
  return volumes.volumes.filter(
    (volume) =>
      volume.volumeUuid !== null &&
      !volume.inUse &&
      volume.state === codes.volumeStates.mounted &&
      volume.awayFiles > 0,
  );
}

export function offeredCards(
  state: DataFolderState,
): readonly DataFolderVolume[] {
  return returnedCards(state).filter(
    ({ volumeUuid }) =>
      volumeUuid === null || !state.declined.includes(volumeUuid),
  );
}

export function resumeBlocked(state: DataFolderState): boolean {
  return state.pending || returnSourceMissing(state);
}

export function cardMounted(
  { volumes, codes }: Pick<DataFolderState, 'volumes' | 'codes'>,
  volumeUuid: string | null,
): boolean {
  return (
    volumes?.volumes.some(
      (volume) =>
        volume.volumeUuid === volumeUuid &&
        volume.state === codes?.volumeStates.mounted,
    ) === true
  );
}

export function returnSourceMissing(state: DataFolderState): boolean {
  const { move, volumes, codes } = state;
  if (move?.cardReturn !== true || volumes === null || codes === null)
    return false;
  return !cardMounted(state, move.sourceVolumeUuid);
}

// A card stays declined only while it stays in: the next insertion offers it again.
function stillInserted(
  declined: readonly string[],
  volumes: DataFolderVolumes,
  codes: DataFolderCodes | null,
): readonly string[] {
  return declined.filter((uuid) => cardMounted({ volumes, codes }, uuid));
}

export function folderUnavailable(state: DataFolderState): boolean {
  return state.volumes?.currentAvailable === false;
}

type SetState = StoreApi<DataFolderStore>['setState'];

function releaseTracker(
  deps: DataFolderDeps,
  set: SetState,
  get: () => DataFolderStore,
) {
  const settle = () => {
    const { holders } = get();
    if (holders === null) return;
    const next = stillHolding(holders, deps.players.tracks());
    if (!oldRootReleased(next)) {
      set({ holders: next });
      return;
    }
    set({ holders: null, released: true });
    deps.native().releaseOldCopies();
  };
  const follow = (move: MoveStatus | null) => {
    if (move?.switched !== true) {
      set({ holders: null, released: false });
      return;
    }
    const { holders, released } = get();
    if (!released && holders === null) {
      set({ holders: deps.players.tracks() });
    }
    settle();
  };
  return { settle, follow };
}

export function createDataFolderStore(
  deps: DataFolderDeps = defaultDeps,
): StoreApi<DataFolderStore> {
  return createStore<DataFolderStore>((set, get) => {
    const release = releaseTracker(deps, set, get);
    let stopWatching: (() => void) | null = null;

    const refuse = (error: unknown) => {
      const code = errorCode(error);
      if (code === null) warn('Data folder request failed', error);
      set({ error: code ?? get().codes?.moveErrors.io ?? null });
    };

    // Launch-time clean-up can finish a move before a queued resume reaches it.
    const dropMootRefusal = () => {
      const { codes, error, move } = get();
      if (
        move === null &&
        error !== null &&
        error === codes?.moveErrors.noMove
      ) {
        set({ error: null });
      }
    };

    const request = async (call: () => Promise<void>) => {
      if (get().pending) return false;
      set({ pending: true });
      let acted = true;
      try {
        await call();
        set({ error: null });
      } catch (error) {
        acted = false;
        refuse(error);
      }
      await Promise.all([get().refreshMove(), get().refreshVolumes()]);
      dropMootRefusal();
      set({ pending: false });
      return acted;
    };

    const showMove = (move: MoveStatus | null) => {
      set({ move });
      release.follow(move);
    };

    const onFinished = (finished: MoveFinished) => {
      const { codes } = get();
      const settled =
        codes === null || moveSettled(finished, codes.moveOutcomes);
      set({
        finished,
        error: settled ? null : (finished.error ?? get().error),
      });
      void get().refreshMove().then(dropMootRefusal);
      void get().refreshVolumes();
    };

    return {
      ...INITIAL,
      start: async () => {
        if (stopWatching !== null) return;
        const native = deps.native();
        set({ codes: native.codes() });
        const stopMove = native.watchMove({
          progress: showMove,
          finished: onFinished,
        });
        const stopFolder = native.watchDataFolder(() => {
          void get().refreshVolumes();
        });
        const stopPlayers = deps.players.subscribe(release.settle);
        stopWatching = () => {
          stopMove();
          stopFolder();
          stopPlayers();
        };
        await Promise.all([get().refreshMove(), get().refreshVolumes()]);
      },
      stop: () => {
        stopWatching?.();
        stopWatching = null;
      },
      refreshVolumes: async () => {
        try {
          const volumes = await deps.native().listVolumes();
          const { declined, codes } = get();
          set({ volumes, declined: stillInserted(declined, volumes, codes) });
        } catch (error) {
          warn('Data folder volumes unavailable', error);
        }
      },
      refreshMove: async () => {
        try {
          showMove(await deps.native().moveStatus());
        } catch (error) {
          warn('Data folder move status unavailable', error);
        }
      },
      startMove: (volumeUuid) =>
        request(() => deps.native().startMove(volumeUuid)),
      returnCard: (volumeUuid) =>
        request(() => deps.native().startCardReturn(volumeUuid)),
      cancelMove: () => request(() => deps.native().cancelMove()),
      resumeMove: () => request(() => deps.native().resumeMove()),
      undoMove: () => request(() => deps.native().undoMove()),
      switchToInternalStorage: () =>
        request(async () => {
          const paths = awayPaths(await deps.storedFiles());
          await deps.native().switchToInternalStorage(paths);
        }),
      declineReturn: (volumeUuid) => {
        const { declined } = get();
        if (!declined.includes(volumeUuid))
          set({ declined: [...declined, volumeUuid] });
      },
      dismissError: () => {
        set({ error: null });
      },
    };
  });
}

export const dataFolderStore = createDataFolderStore();
