import { configureSongLibrary } from '@kitbag/core-state';

const unavailable = () =>
  Promise.reject(new Error('No song import on web; it needs the device'));

configureSongLibrary({
  records: {
    list: () => Promise.resolve([]),
    insertSong: unavailable,
    beginAnalysis: () => Promise.resolve(undefined),
    claimUnfinishedAnalyses: () => Promise.resolve([]),
    applyAnalysis: unavailable,
    deleteSong: () => Promise.resolve(undefined),
    deleteStemSet: () => Promise.resolve({ folder: null, files: [] }),
    findStemSetByJobId: () => Promise.resolve(undefined),
    insertStemBundle: unavailable,
    replaceStemBundle: unavailable,
    listStemSetFolders: () => Promise.resolve([]),
    renameSong: unavailable,
    renameStemSet: unavailable,
  },
  files: {
    constants: () => {
      throw new Error('No native library on web');
    },
    pickDocument: unavailable,
    pickFolder: unavailable,
    importAudio: unavailable,
    enqueueAnalysis: () => undefined,
    cancelAnalysis: () => undefined,
    pendingAnalyses: () => Promise.resolve([]),
    acknowledgeAnalysis: () => undefined,
    onAnalysis: () => () => undefined,
    deleteLibraryFile: unavailable,
    deleteSongFolder: unavailable,
    checkStemBundle: unavailable,
    importStemBundle: unavailable,
    listStemFolders: () => Promise.resolve([]),
    deleteStemFolder: unavailable,
  },
});

export const useSongLibraryAnalysis = (): void => undefined;
