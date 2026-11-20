import { countLabel } from '@kitbag/core-design';
import type {
  DataFolderCodes,
  DataFolderVolume,
  DataFolderVolumes,
  MoveStatus,
  StorageReport,
} from '@kitbag/core-native';

import { formatWithGbDecimal } from './bytes.ts';
import { capitalised } from './capitalised.ts';
import { SEPARATOR } from './separator.ts';

export const DATA_FOLDER_LABEL = 'Data folder';
export const INTERNAL_STORAGE = 'Internal storage';
export const IN_USE = 'IN USE';
export const LOCATION_LABEL = 'Location';
export const CHOOSER_HINT =
  'Song audio, stems and waveforms live here. Your song list, setlists and settings stay on the phone.';
export const NO_CARD_HINT = 'Put a portable SD card in to move songs onto it.';
export const CONFIRM_HINTS = [
  'Only song audio, stems and waveforms move. Your song list, setlists and settings stay on the phone.',
  'You can keep playing while files move, and cancel until the files switch over. If you take the card out later, songs on it won’t play until it’s back.',
] as const;
export const MOVING_CLOSE_HINT =
  'Close this and keep using Kitbag. The move carries on, and this row shows how it is going.';
export const STOP_TITLE = 'Stop moving?';
export const MOVE = 'Move';
export const CANCEL = 'Cancel';
export const CANCEL_MOVE = 'Cancel move';
export const KEEP_MOVING = 'Keep moving';
export const STOP_MOVING = 'Stop moving';
export const RESUME = 'Resume';
export const TRY_AGAIN = 'Try again';
export const UNDO = 'Undo';
export const OK = 'OK';
export const NOT_NOW = 'Not now';
export const CHOOSE_ANOTHER = 'Choose another place';
export const CLOSE_DATA_FOLDER = 'Close data folder';

export const OLD_COPIES_WAITING = 'old copies go once nothing plays';
export const OLD_COPIES_LEFT = 'old copies left';

const NOT_FOUND = 'Not found';
const INTERNAL_PLACE = 'internal storage';
export const CARD_PLACE = 'SD card';
export const THE_CARD = 'the SD card';
export const PERCENT = 100;

export function placeName(volumeUuid: string | null): string {
  return volumeUuid === null ? INTERNAL_PLACE : CARD_PLACE;
}

export function thePlace(volumeUuid: string | null): string {
  return volumeUuid === null ? INTERNAL_PLACE : THE_CARD;
}

export function findVolume(
  volumes: DataFolderVolumes,
  volumeUuid: string | null,
): DataFolderVolume | undefined {
  return volumes.volumes.find((volume) => volume.volumeUuid === volumeUuid);
}

export function volumeName(
  volume: Pick<DataFolderVolume, 'volumeUuid' | 'name'> | undefined,
  volumeUuid: string | null = volume?.volumeUuid ?? null,
): string {
  if (volumeUuid === null) return INTERNAL_STORAGE;
  return volume?.name ?? capitalised(CARD_PLACE);
}

export function movePercent(move: MoveStatus): number {
  return move.totalBytes > 0
    ? Math.round((move.doneBytes / move.totalBytes) * PERCENT)
    : 0;
}

const percentDetail = (move: MoveStatus) =>
  `${SEPARATOR} ${String(movePercent(move))}%`;

export function movingTitle(move: MoveStatus): string {
  return `Moving to ${placeName(move.targetVolumeUuid)}`;
}

export function pausedTitle(move: MoveStatus): string {
  return `Move to ${placeName(move.targetVolumeUuid)} paused`;
}

export interface RowValue {
  readonly lead: string;
  readonly detail: string | null;
  readonly missing: boolean;
  readonly highlighted: boolean;
}

export function dataFolderRowValue(
  volumes: DataFolderVolumes,
  move: MoveStatus | null,
): RowValue {
  const quiet = { missing: false, highlighted: false };
  if (move?.switched === true) {
    const moved = `Moved to ${placeName(move.targetVolumeUuid)}`;
    return move.error === null || move.running
      ? {
          lead: moved,
          detail: `${SEPARATOR} ${OLD_COPIES_WAITING}`,
          missing: false,
          highlighted: true,
        }
      : { ...quiet, lead: moved, detail: `${SEPARATOR} ${OLD_COPIES_LEFT}` };
  }
  if (move?.running === true) {
    return {
      lead: movingTitle(move),
      detail: percentDetail(move),
      missing: false,
      highlighted: true,
    };
  }
  if (move !== null) {
    return {
      ...quiet,
      lead: pausedTitle(move),
      detail: null,
    };
  }
  const current = findVolume(volumes, volumes.currentVolumeUuid);
  const name = volumeName(current, volumes.currentVolumeUuid);
  if (!volumes.currentAvailable) {
    return {
      lead: `${name} ${SEPARATOR} not found`,
      detail: null,
      missing: true,
      highlighted: false,
    };
  }
  return {
    ...quiet,
    lead: name,
    detail:
      current === undefined
        ? null
        : `${SEPARATOR} ${formatWithGbDecimal(current.freeBytes)} free`,
  };
}

export function rowValueLabel({ lead, detail }: RowValue): string {
  return detail === null ? lead : `${lead} ${detail}`;
}

export interface LocationValue {
  readonly volume: string;
  readonly moving: string | null;
}

export function locationValue(
  volumes: DataFolderVolumes,
  move: MoveStatus | null,
): LocationValue {
  const volume = volumeName(
    findVolume(volumes, volumes.currentVolumeUuid),
    volumes.currentVolumeUuid,
  );
  return {
    volume,
    moving:
      move?.running === true && !move.switched
        ? `→ ${placeName(move.targetVolumeUuid)} ${percentDetail(move)}`
        : null,
  };
}

export interface MediaSize {
  readonly bytes: number;
}

export function mediaSize({
  libraryAudio,
  stemSets,
}: StorageReport): MediaSize {
  return { bytes: libraryAudio.bytes + stemSets.bytes };
}

export interface VolumeOption {
  readonly volumeUuid: string | null;
  readonly name: string;
  readonly sub: string;
  readonly inUse: boolean;
  readonly offered: boolean;
  readonly shortBy: number | null;
}

export const fileCount = (count: number) => countLabel(count, 'file', 'files');

function freeLine(volume: DataFolderVolume): string {
  return `${formatWithGbDecimal(volume.freeBytes)} free`;
}

function blockedLine(
  volume: DataFolderVolume,
  volumes: DataFolderVolumes,
  codes: DataFolderCodes,
): string | null {
  if (volume.state === codes.volumeStates.readOnly) {
    return 'Read-only. Kitbag can’t write to this card.';
  }
  if (volume.state === codes.volumeStates.unmounted) {
    return 'Not mounted. Put the card back to use it.';
  }
  if (volumes.requiredBytes === null) {
    return `Kitbag can’t read the current folder, so nothing can move.`;
  }
  if (volume.freeBytes < volumes.requiredBytes) {
    return `${freeLine(volume)} ${SEPARATOR} needs ${formatWithGbDecimal(volumes.requiredBytes)}`;
  }
  return null;
}

export function volumeOption(
  volume: DataFolderVolume,
  volumes: DataFolderVolumes,
  codes: DataFolderCodes,
  media: MediaSize | null,
): VolumeOption {
  const base = {
    volumeUuid: volume.volumeUuid,
    name: volumeName(volume),
    inUse: volume.inUse,
  };
  if (volume.inUse) {
    const used =
      media === null
        ? ''
        : ` ${SEPARATOR} ${formatWithGbDecimal(media.bytes)} used`;
    const mounted = volume.state !== codes.volumeStates.unmounted;
    return {
      ...base,
      sub: mounted ? `${freeLine(volume)}${used}` : NOT_FOUND,
      offered: false,
      shortBy: null,
    };
  }
  const blocked = blockedLine(volume, volumes, codes);
  const required = volumes.requiredBytes;
  const short =
    required !== null &&
    volume.state === codes.volumeStates.mounted &&
    volume.freeBytes < required
      ? required - volume.freeBytes
      : null;
  return {
    ...base,
    sub: blocked ?? freeLine(volume),
    offered: blocked === null,
    shortBy: short,
  };
}

export function noSpaceHint(option: VolumeOption): string | null {
  if (option.shortBy === null) return null;
  return `Free up ${formatWithGbDecimal(option.shortBy)} on ${thePlace(option.volumeUuid)} to move here. Nothing has moved.`;
}

export function confirmTitle(target: string | null): string {
  return `Move to ${placeName(target)}?`;
}

export function mediaText(media: MediaSize): string {
  return formatWithGbDecimal(media.bytes);
}

export function freeAfterLabel(target: string | null): string {
  return `Free on ${thePlace(target)} after`;
}

export function freeAfterText(volume: DataFolderVolume, media: MediaSize) {
  return formatWithGbDecimal(Math.max(0, volume.freeBytes - media.bytes));
}
