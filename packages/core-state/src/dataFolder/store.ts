import type {
  DataFolderCodes,
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
}

export interface DataFolderActions {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly refreshVolumes: () => Promise<void>;
  readonly refreshMove: () => Promise<void>;
  readonly startMove: (volumeUuid: string | null) => Promise<void>;
  readonly cancelMove: () => Promise<void>;
  readonly resumeMove: () => Promise<void>;
  readonly undoMove: () => Promise<void>;
  readonly switchToInternalStorage: () => Promise<void>;
  readonly dismissError: () => void;
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
};

export function pausedMove(state: DataFolderState): MoveStatus | null {
  const { move } = state;
  return move?.paused === true && move.error === null ? move : null;
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

    const request = async (call: () => Promise<void>) => {
      try {
        await call();
        set({ error: null });
      } catch (error) {
        refuse(error);
      }
      await Promise.all([get().refreshMove(), get().refreshVolumes()]);
    };

    const showMove = (move: MoveStatus | null) => {
      set({ move });
      release.follow(move);
    };

    const onFinished = (finished: MoveFinished) => {
      set(
        finished.error === null
          ? { finished }
          : { finished, error: finished.error },
      );
      void get().refreshMove();
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
          set({ volumes: await deps.native().listVolumes() });
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
      cancelMove: () => request(() => deps.native().cancelMove()),
      resumeMove: () => request(() => deps.native().resumeMove()),
      undoMove: () => request(() => deps.native().undoMove()),
      switchToInternalStorage: () =>
        request(async () => {
          const paths = awayPaths(await deps.storedFiles());
          await deps.native().switchToInternalStorage(paths);
        }),
      dismissError: () => {
        set({ error: null });
      },
    };
  });
}

export const dataFolderStore = createDataFolderStore();
