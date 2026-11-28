import {
  createThemedStyles,
  snackbar,
  Snackbar,
  space,
} from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { TAPS_CLEARED, type PlayAlongLock } from '@kitbag/core-state';
import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { METER_PLACE, type LockLayout } from '../logic/lockLayout.ts';
import { PAD_SLOT_BOTTOM } from '../logic/padFit.ts';
import { trackClock } from '../logic/nowPlaying.ts';
import { PLAY_ALONG_VIEW, type PlayAlongView } from '../logic/playAlongView.ts';
import { BpmCard } from './BpmCard.tsx';
import { DriftMeter } from './DriftMeter.tsx';
import { FadedScroll } from './FadedScroll.tsx';
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
import { TempoChoiceCard } from './TempoChoiceCard.tsx';
import { useNewTrack, type NewTrack } from './useNewTrack.ts';
import { usePadFit } from './usePadFit.ts';
import { useDriftInputs } from './useDriftInputs.ts';
import { useLockedPad } from './useLockedPad.ts';
import { useTapPad } from './useTapPad.ts';

const useStyles = createThemedStyles(() => ({
  region: { flex: 1 },
  body: {
    gap: space.sectionGap,
    paddingHorizontal: space.screenInset,
    paddingBottom: space.sectionGap,
  },
  pad: {
    paddingHorizontal: space.screenInset,
    paddingBottom: PAD_SLOT_BOTTOM,
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
const TAPS_CLEARED_NOTICE = 'New track. Your taps were cleared.';

function NoSong({
  view,
  onExplainAgain,
}: Pick<PlayAlongBodyProps, 'view' | 'onExplainAgain'>) {
  if (view === PLAY_ALONG_VIEW.nothing) return <NothingPlaying />;
  return <NotFollowingRow onPress={onExplainAgain} />;
}

function TapsClearedNotice() {
  const cleared = usePlayAlong(
    (s) => s.tapAlong.cleared === TAPS_CLEARED.track,
  );
  const forget = usePlayAlong((s) => s.forgetClearedTaps);
  if (!cleared) return null;
  return (
    <Snackbar
      message={TAPS_CLEARED_NOTICE}
      bottom={snackbar.aboveDock}
      onTimeout={forget}
    />
  );
}

function NewTrackNotice({ track }: { readonly track: NewTrack }) {
  if (!track.noticeShown) return <TapsClearedNotice />;
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
  readonly onBpmCardLayout: (event: LayoutChangeEvent) => void;
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
      <TempoChoiceCard />
      <View onLayout={props.onBpmCardLayout}>
        <BpmCard
          bpm={bpm}
          line={line}
          newTrack={props.newTrack}
          onOpenTempo={props.onOpenTempo}
        />
      </View>
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
  readonly fit: ReturnType<typeof usePadFit>;
}

function PinnedPad({ view, session, lock, locked, fit }: PinnedPadProps) {
  const styles = useStyles();
  const pad = useTapPad({
    following: view === PLAY_ALONG_VIEW.song && session !== undefined,
    lockBpm: lock?.bpm ?? null,
    playing: session?.playing === true,
    retap: locked.retap,
    onLanded: locked.onLanded,
  });
  return (
    <View style={styles.pad} onLayout={fit.onSlot}>
      <TapPad {...pad} minHeight={fit.padHeight} onRelease={locked.onRelease} />
    </View>
  );
}

export function PlayAlongBody(props: PlayAlongBodyProps) {
  const { session, lock } = props;
  const drift = useDriftInputs(session);
  const locked = useLockedPad(lock, drift);
  const track = useNewTrack(session, lock);
  const fit = usePadFit();
  const styles = useStyles();
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
    <View style={styles.region} onLayout={fit.onRegion}>
      <FadedScroll overlay={<NewTrackNotice track={track} />}>
        <BodyCards
          {...props}
          layout={locked.layout}
          meter={meter}
          newTrack={track.newTrack}
          silenced={locked.silenced}
          onBpmCardLayout={fit.onBpmCard}
        />
      </FadedScroll>
      {locked.layout.pad ? (
        <PinnedPad {...props} locked={locked} fit={fit} />
      ) : null}
    </View>
  );
}
