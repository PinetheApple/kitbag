import {
  createThemedStyles,
  fadeToClear,
  metronome,
  snackbar,
  Snackbar,
  space,
  usePlayerScroll,
} from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { PlayAlongLock } from '@kitbag/core-state';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { METER_PLACE, type LockLayout } from '../logic/lockLayout.ts';
import { trackClock } from '../logic/nowPlaying.ts';
import { PLAY_ALONG_VIEW, type PlayAlongView } from '../logic/playAlongView.ts';
import { BpmCard } from './BpmCard.tsx';
import { DriftMeter } from './DriftMeter.tsx';
import { LibraryOfferCard } from './LibraryOfferCard.tsx';
import { PatternCard } from './PatternCard.tsx';
import { NotFollowingRow, NothingPlaying } from './NoSong.tsx';
import { NowPlayingCard } from './NowPlayingCard.tsx';
import {
  usePlayAlong,
  useSongPositionMs,
  useTempoLine,
} from './playAlongHooks.ts';
import { TapPad } from './TapPad.tsx';
import { useNewTrack, type NewTrack } from './useNewTrack.ts';
import { useDriftInputs } from './useDriftInputs.ts';
import { useLockedPad } from './useLockedPad.ts';
import { useTapPad } from './useTapPad.ts';

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
  readonly onOpenMeter: () => void;
  readonly onOpenSubdivision: () => void;
  readonly onOpenPhase: () => void;
}

const NEW_TRACK_NOTICE = 'New track. The click stopped until you tap.';

function NoSong({
  view,
  onExplainAgain,
}: Pick<PlayAlongBodyProps, 'view' | 'onExplainAgain'>) {
  if (view === PLAY_ALONG_VIEW.nothing) return <NothingPlaying />;
  return <NotFollowingRow onPress={onExplainAgain} />;
}

interface FadedScrollProps {
  readonly children: ReactNode;
  readonly overlay: ReactNode;
}

function FadedScroll({ children, overlay }: FadedScrollProps) {
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
      {overlay}
    </View>
  );
}

function NewTrackNotice({ track }: { readonly track: NewTrack }) {
  if (!track.noticeShown) return null;
  return (
    <Snackbar
      message={NEW_TRACK_NOTICE}
      bottom={snackbar.aboveDock}
      onTimeout={track.hideNotice}
    />
  );
}

interface BodyCardsProps extends PlayAlongBodyProps {
  readonly layout: LockLayout;
  readonly meter: ReactNode;
  readonly newTrack: boolean;
  readonly silenced: boolean;
}

function BodyCards(props: BodyCardsProps) {
  const styles = useStyles();
  const { view, session, lock, layout, meter } = props;
  const { bpm, line } = useTempoLine();
  const offered = usePlayAlong((s) => s.offer !== undefined);
  return (
    <View style={styles.body}>
      {layout.meter === METER_PLACE.first ? meter : null}
      {view === PLAY_ALONG_VIEW.song ? (
        <SongCard session={session} lock={lock} />
      ) : (
        <NoSong view={view} onExplainAgain={props.onExplainAgain} />
      )}
      <BpmCard
        bpm={bpm}
        line={line}
        newTrack={props.newTrack}
        onOpenTempo={props.onOpenTempo}
      />
      {offered && lock === undefined ? <LibraryOfferCard /> : null}
      <PatternCard
        following={lock !== undefined}
        muted={props.silenced}
        onOpenMeter={props.onOpenMeter}
        onOpenSubdivision={props.onOpenSubdivision}
      />
      {layout.meter === METER_PLACE.last ? meter : null}
    </View>
  );
}

interface PinnedPadProps extends PlayAlongBodyProps {
  readonly locked: ReturnType<typeof useLockedPad>;
}

function PinnedPad({ view, session, lock, locked }: PinnedPadProps) {
  const styles = useStyles();
  const pad = useTapPad({
    following: view === PLAY_ALONG_VIEW.song && session !== undefined,
    locked: lock !== undefined,
    retap: locked.retap,
    onLanded: locked.onLanded,
  });
  return (
    <View style={styles.pad}>
      <TapPad {...pad} onRelease={locked.onRelease} />
    </View>
  );
}

export function PlayAlongBody(props: PlayAlongBodyProps) {
  const { session, lock } = props;
  const drift = useDriftInputs(session);
  const locked = useLockedPad(lock, drift);
  const track = useNewTrack(session, lock);
  const meter =
    lock === undefined ? null : (
      <DriftMeter
        lock={lock}
        session={session}
        drift={drift}
        onRetap={locked.onRetap}
        onOpenPhase={props.onOpenPhase}
      />
    );
  return (
    <>
      <FadedScroll overlay={<NewTrackNotice track={track} />}>
        <BodyCards
          {...props}
          layout={locked.layout}
          meter={meter}
          newTrack={track.newTrack}
          silenced={locked.silenced}
        />
      </FadedScroll>
      {locked.layout.pad ? <PinnedPad {...props} locked={locked} /> : null}
    </>
  );
}
