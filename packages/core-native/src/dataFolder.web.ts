import type * as Native from './dataFolder.ts';

const NEEDS_APP = 'Moving the data folder needs the Android app';

const refuse = () => Promise.reject(new Error(NEEDS_APP));

export const dataFolderCodes: typeof Native.dataFolderCodes = () => {
  throw new Error(NEEDS_APP);
};

export const listVolumes: typeof Native.listVolumes = refuse;

export const startMove: typeof Native.startMove = refuse;

export const cancelMove: typeof Native.cancelMove = refuse;

export const resumeMove: typeof Native.resumeMove = refuse;

export const undoMove: typeof Native.undoMove = refuse;

export const switchToInternalStorage: typeof Native.switchToInternalStorage =
  refuse;

export const moveStatus: typeof Native.moveStatus = () => Promise.resolve(null);

export const releaseOldCopies: typeof Native.releaseOldCopies = () => undefined;

export const watchMove: typeof Native.watchMove = () => () => undefined;
