import { usePlayingEdge } from '@kitbag/core-design';
import {
  KITBAG_HOST_OBJECT_KEY,
  type KitbagHostObject,
} from '@kitbag/core-native';
import {
  useLiveSongPlayer,
  useLiveStemPlayer,
  useShownSongId,
  useShownStemSetId,
  type LibraryRow,
} from '@kitbag/core-state';
import { useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

const NO_COUNT = -1;
const STOPPED = 0;
const STARTED = 1;
const PLAYING_UNTIL_POLLED = true;

export function useNowPlaying(row: LibraryRow): boolean {
  const songId = useShownSongId();
  const setId = useShownStemSetId();
  return row.id === (row.kind === 'stems' ? setId : songId);
}

function useShownCountEnd(kind: LibraryRow['kind']): number {
  const song = useLiveSongPlayer((s) => s.countEndFrame);
  const stems = useLiveStemPlayer((s) => s.countEndFrame);
  return (kind === 'stems' ? stems : song) ?? NO_COUNT;
}

export function useShownPlaying(kind: LibraryRow['kind']): boolean {
  const countEndFrame = useShownCountEnd(kind);
  const countEnd = useSharedValue(countEndFrame);
  const started = useSharedValue(STARTED);
  useEffect(() => {
    countEnd.value = countEndFrame;
  }, [countEnd, countEndFrame]);
  useFrameCallback(() => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) return;
    const counting =
      countEnd.value !== NO_COUNT && host.frames_rendered < countEnd.value;
    const now = host.mixer_playing !== 0 || counting ? STARTED : STOPPED;
    if (started.value !== now) started.value = now;
  });
  return usePlayingEdge(started, PLAYING_UNTIL_POLLED);
}
