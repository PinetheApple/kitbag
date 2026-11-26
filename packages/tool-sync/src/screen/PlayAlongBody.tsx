import { createThemedStyles, PlayerScroll, space } from '@kitbag/core-design';
import { boottimeNowMs, type MediaSessionSnapshot } from '@kitbag/core-native';
import {
  BPM_SOURCE,
  getPlayAlongStore,
  tempoLadderStore,
  useTempoLadder,
  type PlayAlongLock,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';

import { trackClock } from '../logic/nowPlaying.ts';
import { PLAY_ALONG_VIEW, type PlayAlongView } from '../logic/playAlongView.ts';
import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';
import { tempoLine } from '../logic/tempoLine.ts';
import { BpmCard } from './BpmCard.tsx';
import { NotFollowingRow, NothingPlaying } from './NoSongCard.tsx';
import { NowPlayingCard } from './NowPlayingCard.tsx';
import { useSongPositionMs } from './playAlongHooks.ts';
import { TapPad } from './TapPad.tsx';

const useStyles = createThemedStyles(() => ({
  body: {
    gap: space.sectionGap,
    paddingHorizontal: space.screenInset,
    paddingBottom: space.sectionGap,
  },
  pad: {
    paddingHorizontal: space.screenInset,
    paddingBottom: space.sectionGap,
  },
}));

interface SongCardProps {
  readonly session: MediaSessionSnapshot | undefined;
  readonly lock: PlayAlongLock | undefined;
}

function SongCard({ session, lock }: SongCardProps) {
  const positionMs = useSongPositionMs(session);
  const track = session ?? lock?.track;
  return (
    <NowPlayingCard
      title={track?.title ?? null}
      artist={track?.artist ?? null}
      clock={
        session === undefined
          ? null
          : trackClock(positionMs, session.durationMs)
      }
      greyed={session === undefined}
    />
  );
}

export interface PlayAlongBodyProps extends SongCardProps {
  readonly view: PlayAlongView;
  readonly onExplainAgain: () => void;
  readonly onOpenTempo: () => void;
}

function useTapPad(following: boolean, locked: boolean) {
  const bpm = useTempoLadder((s) => s.bpm);
  const source = useTempoLadder((s) => s.source);
  const tapsLanded = useTempoLadder((s) => s.tapsLanded);
  const copy = tapPadCopy({
    following,
    locked,
    songBpm: bpm,
    tappedBpm: source === BPM_SOURCE.tap ? bpm : null,
    tapsLanded,
  });
  const onTap = useCallback(() => {
    const now = boottimeNowMs();
    if (copy.mode === TAP_PAD_MODE.tempo) tempoLadderStore.getState().tap(now);
    else getPlayAlongStore().getState().tap(now);
  }, [copy.mode]);
  return { copy, tapsLanded, onTap };
}

function NoSong({
  view,
  onExplainAgain,
}: Omit<PlayAlongBodyProps, keyof SongCardProps | 'onOpenTempo'>) {
  if (view === PLAY_ALONG_VIEW.nothing) return <NothingPlaying />;
  return <NotFollowingRow onPress={onExplainAgain} />;
}

export function PlayAlongBody(props: PlayAlongBodyProps) {
  const styles = useStyles();
  const { view, session, lock, onOpenTempo } = props;
  const hasSong = view === PLAY_ALONG_VIEW.song;
  const pad = useTapPad(hasSong && session !== undefined, lock !== undefined);
  const lookup = useTempoLadder((s) => s);
  return (
    <>
      <PlayerScroll>
        <View style={styles.body}>
          {hasSong ? (
            <SongCard session={session} lock={lock} />
          ) : (
            <NoSong {...props} />
          )}
          <BpmCard
            bpm={lookup.bpm}
            line={tempoLine(lookup)}
            onOpenTempo={onOpenTempo}
          />
        </View>
      </PlayerScroll>
      <View style={styles.pad}>
        <TapPad {...pad} />
      </View>
    </>
  );
}
