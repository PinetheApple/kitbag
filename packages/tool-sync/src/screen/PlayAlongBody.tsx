import {
  createThemedStyles,
  fadeToClear,
  metronome,
  space,
  usePlayerScroll,
} from '@kitbag/core-design';
import { boottimeNowMs, type MediaSessionSnapshot } from '@kitbag/core-native';
import {
  BPM_SOURCE,
  getPlayAlongStore,
  tempoLadderStore,
  useTempoLadder,
  type PlayAlongLock,
} from '@kitbag/core-state';
import { useCallback, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { trackClock } from '../logic/nowPlaying.ts';
import { PLAY_ALONG_VIEW, type PlayAlongView } from '../logic/playAlongView.ts';
import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';
import { BpmCard } from './BpmCard.tsx';
import { NotFollowingRow, NothingPlaying } from './NoSong.tsx';
import { NowPlayingCard } from './NowPlayingCard.tsx';
import { useSongPositionMs, useTempoLine } from './playAlongHooks.ts';
import { TapPad } from './TapPad.tsx';

export const SCROLL_FADE_ID = 'play-along-scroll-fade';

const useStyles = createThemedStyles((theme) => ({
  scrollBox: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  body: {
    gap: space.sectionGap,
    paddingHorizontal: space.screenInset,
    paddingBottom: space.sectionGap,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: metronome.scrollFade,
    pointerEvents: 'none',
    ...fadeToClear(theme.color.bg, 'to top'),
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
}: Pick<PlayAlongBodyProps, 'view' | 'onExplainAgain'>) {
  if (view === PLAY_ALONG_VIEW.nothing) return <NothingPlaying />;
  return <NotFollowingRow onPress={onExplainAgain} />;
}

function FadedScroll({ children }: { readonly children: ReactNode }) {
  const styles = useStyles();
  const scroll = usePlayerScroll();
  return (
    <View style={styles.scrollBox}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={scroll.scrollEnabled}
        persistentScrollbar
        {...scroll}
      >
        {children}
      </ScrollView>
      {scroll.scrollEnabled ? (
        <View testID={SCROLL_FADE_ID} style={styles.fade} />
      ) : null}
    </View>
  );
}

export function PlayAlongBody(props: PlayAlongBodyProps) {
  const styles = useStyles();
  const { view, session, lock, onOpenTempo } = props;
  const hasSong = view === PLAY_ALONG_VIEW.song;
  const pad = useTapPad(hasSong && session !== undefined, lock !== undefined);
  const { bpm, line } = useTempoLine();
  return (
    <>
      <FadedScroll>
        <View style={styles.body}>
          {hasSong ? (
            <SongCard session={session} lock={lock} />
          ) : (
            <NoSong view={view} onExplainAgain={props.onExplainAgain} />
          )}
          <BpmCard bpm={bpm} line={line} onOpenTempo={onOpenTempo} />
        </View>
      </FadedScroll>
      <View style={styles.pad}>
        <TapPad {...pad} />
      </View>
    </>
  );
}
