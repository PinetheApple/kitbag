import {
  createThemedStyles,
  fadeToClear,
  metronome,
  snackbar,
  Snackbar,
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
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { DRIFT_STATE, driftState } from '../logic/driftMeter.ts';
import { lockLayout, METER_PLACE } from '../logic/lockLayout.ts';
import { trackClock } from '../logic/nowPlaying.ts';
import { PLAY_ALONG_VIEW, type PlayAlongView } from '../logic/playAlongView.ts';
import { TAP_PAD_MODE, tapPadCopy } from '../logic/tapPad.ts';
import { BpmCard } from './BpmCard.tsx';
import { DriftMeter } from './DriftMeter.tsx';
import { NotFollowingRow, NothingPlaying } from './NoSong.tsx';
import { NowPlayingCard } from './NowPlayingCard.tsx';
import {
  usePlayAlong,
  useSongPositionMs,
  useTempoLine,
} from './playAlongHooks.ts';
import { TapPad } from './TapPad.tsx';
import { useNewTrack } from './useNewTrack.ts';

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

const NEW_TRACK_NOTICE = 'New track. The click stopped until you tap.';

interface PadInputs {
  readonly following: boolean;
  readonly locked: boolean;
  readonly retap: boolean;
  readonly onLanded: () => void;
}

function useTapPad({ following, locked, retap, onLanded }: PadInputs) {
  const bpm = useTempoLadder((s) => s.bpm);
  const source = useTempoLadder((s) => s.source);
  const tapsLanded = useTempoLadder((s) => s.tapsLanded);
  const copy = tapPadCopy({
    following,
    locked,
    retap,
    songBpm: bpm,
    tappedBpm: source === BPM_SOURCE.tap ? bpm : null,
    tapsLanded,
  });
  const onTap = useCallback(() => {
    const now = boottimeNowMs();
    if (copy.mode === TAP_PAD_MODE.tempo) {
      tempoLadderStore.getState().tap(now);
      return;
    }
    if (getPlayAlongStore().getState().tap(now).locked) onLanded();
  }, [copy.mode, onLanded]);
  return { copy, tapsLanded, onTap };
}

function useLockedPad(
  session: MediaSessionSnapshot | undefined,
  lock: PlayAlongLock | undefined,
) {
  const [retapping, setRetapping] = useState(false);
  const [padHeld, setPadHeld] = useState(false);
  const songAheadOfClickMs = usePlayAlong((s) => s.songAheadOfClickMs);
  const sourceGoneAtMs = usePlayAlong((s) => s.sourceGoneAtBoottimeMs);
  const drifting =
    driftState({
      songAheadOfClickMs,
      playing: session?.playing === true,
      sourceGoneAtMs,
    }) === DRIFT_STATE.drift;
  const locked = lock !== undefined;
  const retap = locked && (drifting || retapping);
  const layout = lockLayout({ locked, drifting, retapping: retap, padHeld });
  const onRetap = useCallback(() => {
    setRetapping(true);
  }, []);
  const onLanded = useCallback(() => {
    setRetapping(false);
    setPadHeld(true);
  }, []);
  const onRelease = useCallback(() => {
    setPadHeld(false);
  }, []);
  return { layout, retap, onRetap, onLanded, onRelease };
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
  const locked = useLockedPad(session, lock);
  const pad = useTapPad({
    following: hasSong && session !== undefined,
    locked: lock !== undefined,
    retap: locked.retap,
    onLanded: locked.onLanded,
  });
  const track = useNewTrack(session, lock);
  const { bpm, line } = useTempoLine();
  const meter =
    lock === undefined ? null : (
      <DriftMeter lock={lock} session={session} onRetap={locked.onRetap} />
    );
  const { layout } = locked;
  return (
    <>
      <FadedScroll>
        <View style={styles.body}>
          {layout.meter === METER_PLACE.first ? meter : null}
          {hasSong ? (
            <SongCard session={session} lock={lock} />
          ) : (
            <NoSong view={view} onExplainAgain={props.onExplainAgain} />
          )}
          <BpmCard
            bpm={bpm}
            line={line}
            newTrack={track.newTrack}
            onOpenTempo={onOpenTempo}
          />
          {layout.meter === METER_PLACE.last ? meter : null}
        </View>
        {track.noticeShown ? (
          <Snackbar
            message={NEW_TRACK_NOTICE}
            bottom={snackbar.aboveDock}
            onTimeout={track.hideNotice}
          />
        ) : null}
      </FadedScroll>
      {layout.pad ? (
        <View style={styles.pad}>
          <TapPad {...pad} onRelease={locked.onRelease} />
        </View>
      ) : null}
    </>
  );
}
