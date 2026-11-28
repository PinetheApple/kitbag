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
import { useEffect, useState } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

const NO_COUNT = -1;
const STOPPED = 0;
const STARTED = 1;

function installedHost(): KitbagHostObject | undefined {
  'worklet';
  return (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
}

function isStarted(host: KitbagHostObject, countEnd: number): boolean {
  'worklet';
  const counting = countEnd !== NO_COUNT && host.frames_rendered < countEnd;
  return host.mixer_playing !== 0 || counting;
}

export function useIsCurrentRow(row: LibraryRow): boolean {
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
  const [seed] = useState(() => {
    const host = installedHost();
    return host !== undefined && isStarted(host, countEndFrame);
  });
  const countEnd = useSharedValue(countEndFrame);
  const playing = useSharedValue(seed ? STARTED : STOPPED);
  useEffect(() => {
    countEnd.value = countEndFrame;
  }, [countEnd, countEndFrame]);
  useFrameCallback(() => {
    'worklet';
    const host = installedHost();
    if (host === undefined) return;
    const started = isStarted(host, countEnd.value) ? STARTED : STOPPED;
    if (playing.value !== started) playing.value = started;
  });
  return usePlayingEdge(playing, seed);
}
