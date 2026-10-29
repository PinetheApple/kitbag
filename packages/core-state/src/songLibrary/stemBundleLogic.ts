import type { NewStemBundle, StemSetFiles } from '@kitbag/core-db';
import type {
  ImportedStemBundle,
  LibraryConstants,
  StemBundleCheck,
} from '@kitbag/core-native';

import { fileRemovals, type Removal } from './logic.ts';

export type BundleRefusalReason =
  'notABundle' | 'version' | 'tooManyStems' | 'noSpace' | 'unreadable';

export interface BundleRefusal {
  readonly reason: BundleRefusalReason;
  readonly version: number;
  readonly supportedVersion: number;
  readonly stemCount: number;
  readonly maxStems: number;
}

export function refusalReason(
  code: string | null,
  codes: LibraryConstants,
): BundleRefusalReason | null {
  switch (code) {
    case codes.bundleRefusalNotABundle:
      return 'notABundle';
    case codes.bundleRefusalVersion:
      return 'version';
    case codes.bundleRefusalTooManyStems:
      return 'tooManyStems';
    case codes.bundleRefusalNoSpace:
      return 'noSpace';
    case codes.bundleRefusalUnreadable:
      return 'unreadable';
    default:
      return null;
  }
}

export function refusal(
  reason: BundleRefusalReason,
  check: StemBundleCheck | null,
): BundleRefusal {
  return {
    reason,
    version: check?.version ?? 0,
    supportedVersion: check?.supportedVersion ?? 0,
    stemCount: check?.stemCount ?? 0,
    maxStems: check?.maxStems ?? 0,
  };
}

export function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function newStemBundle(
  imported: ImportedStemBundle,
  uuid: string,
): NewStemBundle {
  return {
    uuid,
    jobId: imported.jobId,
    title: imported.title === '' ? imported.jobId : imported.title,
    songTitle: imported.songTitle,
    artist: imported.artist,
    folder: imported.relativeDir,
    sampleRate: imported.sampleRate,
    channels: imported.channels,
    stems: imported.stems.map((stem) => ({
      name: stem.name,
      filePath: stem.relativePath,
      waveformPath: stem.waveformRelativePath,
      frames: stem.frames,
      volume: stem.volume,
      muted: stem.muted,
      soloed: stem.soloed,
      pitch: stem.pitch,
    })),
    bpm: imported.bpm,
    key: imported.key,
    scale: imported.scale,
    keyConfidence: imported.keyConfidence,
    loudnessLufs: imported.loudnessLufs,
    tempoStability: imported.tempoStability,
    sections: imported.sections,
    beats: imported.beats,
    bars: imported.bars,
    lyrics: imported.lyrics,
  };
}

// Only a folder directly under stems/ is removed whole; deleteStemFolder takes
// its leaf name and anything else may be shared.
export function stemFolderName(
  relativeDir: string,
  stemsDir: string | null,
): string | null {
  if (stemsDir === null || !relativeDir.startsWith(`${stemsDir}/`)) return null;
  const name = relativeDir.slice(stemsDir.length + 1);
  return name === '' || name.includes('/') || name.startsWith('.')
    ? null
    : name;
}

export function stemSetRemovals(
  set: StemSetFiles,
  stemsDir: string | null,
): Removal[] {
  const name =
    set.folder === null ? null : stemFolderName(set.folder, stemsDir);
  if (name === null || set.folder === null) return fileRemovals(set.files);
  const inside = `${set.folder}/`;
  return [
    { kind: 'stemFolder', name },
    ...fileRemovals(set.files.filter((path) => !path.startsWith(inside))),
  ];
}
