export type ExportFailure = 'noSpace' | 'tooLong' | 'busy' | 'internal';

export interface ExportCopy {
  readonly title: string;
  readonly body: string;
}

const BYTES_PER_MB = 1_000_000;
const MB_DECIMALS = 1;
export const PERCENT = 100;
const NOTHING_SAVED = 'Nothing was saved.';

export const EXPORT_STARTED = 'Exporting mix';
export const EXPORT_READY = 'Mix ready';
export const EXPORT_CANCELLED = `Export cancelled. ${NOTHING_SAVED}`;
export const EXPORT_SHARE_FAILED: ExportCopy = {
  title: 'Could not share the mix',
  body: 'The file is kept. Share it again, or dismiss this and export again.',
};
export const EXPORT_UNSHARED: ExportCopy = {
  title: 'No app can take this file',
  body: 'No app on this phone accepts a WAV file. Install a file manager or cloud storage app, then share again.',
};

export function megabytes(bytes: number): string {
  return `${(bytes / BYTES_PER_MB).toFixed(MB_DECIMALS)} MB`;
}

export function percentOf(progress: number): number {
  return Math.floor(Math.min(1, Math.max(0, progress)) * PERCENT);
}

export function exportProgressNote(percent: number): string {
  return `Export ${String(percent)} percent done`;
}

export function exportFailureCopy(
  failure: ExportFailure,
  bytes: number,
): ExportCopy {
  switch (failure) {
    case 'noSpace':
      return {
        title: 'Not enough space',
        body: `The mix needs about ${megabytes(bytes)} and this phone does not have that much free. ${NOTHING_SAVED} Free some space, then retry.`,
      };
    case 'tooLong':
      return {
        title: 'Too long for one WAV file',
        body: `At this speed the mix would be about ${megabytes(bytes)}, more than a WAV file can hold. ${NOTHING_SAVED}`,
      };
    case 'busy':
      return {
        title: 'Another export is running',
        body: `Wait for it to finish, then retry. ${NOTHING_SAVED}`,
      };
    case 'internal':
      return {
        title: 'Export failed',
        body: `Something went wrong while making the file. ${NOTHING_SAVED}`,
      };
  }
}
