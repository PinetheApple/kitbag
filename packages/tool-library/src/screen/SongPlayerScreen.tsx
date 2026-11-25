import {
  BeatWaveform,
  Card,
  createThemedStyles,
  PlayerScroll,
  ScrubRow,
  size,
  songPlayer,
  space,
  stemPlayer,
  type ScrubFrame,
} from '@kitbag/core-design';
import {
  framesToSeconds,
  loopEndFrames,
  useFocusedMixerHold,
  useLoopScrub,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { CLICK_GROUP } from '../logic/clickChipText.ts';
import { frameAtTap } from '../logic/waveSeek.ts';
import type { SongPlayhead, UsePlayhead } from './playhead.ts';
import { EndedSetlistSnackbar } from './EndedSetlistSnackbar.tsx';
import { SongAppBar } from './SongAppBar.tsx';
import { SongClickChips } from './SongClickChips.tsx';
import { SongLockCard } from './SongLockCard.tsx';
import {
  SongClickSheet,
  useSongClickSheet,
  type SongClickSheetState,
} from './SongClickSheet.tsx';
import { SongMeter } from './SongMeter.tsx';
import { SongPlayerMenu } from './SongPlayerMenu.tsx';
import { SongTempoCorrection } from './SongTempoCorrection.tsx';
import { SongTempoMode } from './SongTempoMode.tsx';
import { SongTransport } from './SongTransport.tsx';
import { useFollowQueueArrivals } from './useFollowQueueArrivals.ts';
import { useLeaveOnStop } from './useLeaveOnStop.ts';
import { useLoopHandles } from './useLoopHandles.ts';
import { NotReady } from './NotReady.tsx';

export const BODY_SLOT_ID = 'song-body-slot';
const WAVE_CARD_FLOOR =
  songPlayer.cardWave +
  stemPlayer.laneHeight +
  2 * (space.cardPadding + size.stroke);
export const SONG_BODY_FLOOR = stemPlayer.bodyTop + WAVE_CARD_FLOOR;

export interface SongPlayerScreenProps {
  readonly songId: number;
  readonly focused: boolean;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
  readonly usePlayhead: UsePlayhead;
  readonly renderUpNext?: RenderUpNext;
  readonly onOpenQueue?: () => void;
}

export type RenderUpNext = (songSec: SongPlayhead['songSec']) => ReactNode;

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  body: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  slot: { flexGrow: 1, minHeight: SONG_BODY_FLOOR },
  bodyContent: {
    paddingTop: stemPlayer.bodyTop,
    paddingHorizontal: space.screenInset,
    paddingBottom: stemPlayer.bodyGap,
    gap: stemPlayer.bodyGap,
  },
}));

function SongWave({ playhead }: { readonly playhead: ScrubFrame }) {
  const envelope = useSongPlayer((s) => s.envelope);
  const beats = useSongPlayer((s) => s.beats);
  const downbeatIndices = useSongPlayer((s) => s.downbeatIndices);
  const frames = useSongPlayer((s) => s.durationFrames);
  const rate = useSongPlayer((s) => s.engineRate);
  const seek = useSongPlayer((s) => s.seek);
  const { hold } = playhead;
  const onTap = useCallback(
    (xInWaveform: number, waveformWidth: number) => {
      const target = frameAtTap(xInWaveform, waveformWidth, frames);
      if (target === null) return;
      hold(target / frames);
      seek(target);
    },
    [frames, hold, seek],
  );
  return (
    <BeatWaveform
      envelope={envelope}
      progress={playhead.progress}
      beats={beats}
      downbeatIndices={downbeatIndices}
      durationSec={framesToSeconds(frames, rate)}
      onTap={onTap}
    />
  );
}

interface BodyProps {
  readonly songId: number;
  readonly bottom: number;
  readonly meterOpen: boolean;
  readonly tempoModeOpen: boolean;
  readonly tempoOpen: boolean;
  readonly onBack: () => void;
  readonly onCloseMeter: () => void;
  readonly onCloseTempoMode: () => void;
  readonly onCloseTempo: () => void;
  readonly usePlayhead: UsePlayhead;
  readonly clickSheet: SongClickSheetState;
  readonly renderUpNext: RenderUpNext | undefined;
}

function Body({
  songId,
  bottom,
  meterOpen,
  tempoModeOpen,
  tempoOpen,
  onBack,
  onCloseMeter,
  onCloseTempoMode,
  onCloseTempo,
  usePlayhead,
  clickSheet,
  renderUpNext,
}: BodyProps) {
  const styles = useStyles();
  const status = useSongPlayer((s) => s.status);
  const rate = useSongPlayer((s) => s.engineRate);
  const frames = useSongPlayer((s) => s.durationFrames);
  const loopEnd = useSongPlayer(loopEndFrames);
  const playhead = usePlayhead(rate, frames, loopEnd);
  const scrub = useLoopScrub(useSongPlayer);
  const handles = useLoopHandles();
  if (status !== 'ready')
    return (
      <View style={styles.bodyContent}>
        <NotReady songId={songId} status={status} onBack={onBack} />
      </View>
    );
  return (
    <>
      <PlayerScroll>
        <View testID={BODY_SLOT_ID} style={styles.slot}>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            nestedScrollEnabled
          >
            <Card>
              <SongWave playhead={playhead} />
              <ScrubRow frame={playhead} {...scrub} loopHandles={handles} />
            </Card>
            <SongLockCard songId={songId} />
            <SongClickChips onOpen={clickSheet.open} />
          </ScrollView>
        </View>
        <SongTransport
          playing={playhead.playing}
          bottomInset={bottom}
          upNext={renderUpNext?.(playhead.songSec)}
        />
      </PlayerScroll>
      <SongClickSheet
        group={clickSheet.group}
        bottomInset={bottom}
        onDismiss={clickSheet.close}
      />
      <SongMeter
        songId={songId}
        visible={meterOpen}
        bottomInset={bottom}
        playheadSeconds={playhead.songSec}
        onClose={onCloseMeter}
      />
      <SongTempoMode
        visible={tempoModeOpen}
        bottomInset={bottom}
        onClose={onCloseTempoMode}
      />
      <SongTempoCorrection
        songId={songId}
        visible={tempoOpen}
        bottomInset={bottom}
        onClose={onCloseTempo}
      />
    </>
  );
}

export function SongPlayerScreen({
  songId,
  focused,
  insets,
  onBack,
  onOpenStemSet,
  onOpenSong,
  usePlayhead,
  renderUpNext,
  onOpenQueue,
}: SongPlayerScreenProps) {
  const styles = useStyles();
  const open = useSongPlayer((s) => s.open);
  const acquire = useCallback(
    () => open(songId, songPlayer.waveBars).hold,
    [open, songId],
  );
  useFocusedMixerHold(focused, acquire);
  const follow = useMemo(
    () => ({ songId, onOpenStemSet, onOpenSong }),
    [songId, onOpenStemSet, onOpenSong],
  );
  const { leave, markLeft } = useLeaveOnStop(focused, onBack, songId);
  useFollowQueueArrivals(focused, follow, markLeft);
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);
  const [meterOpen, setMeterOpen] = useState(false);
  const openMeter = useCallback(() => {
    setMeterOpen(true);
  }, []);
  const closeMeter = useCallback(() => {
    setMeterOpen(false);
  }, []);
  const [tempoModeOpen, setTempoModeOpen] = useState(false);
  const openTempoMode = useCallback(() => {
    setTempoModeOpen(true);
  }, []);
  const closeTempoMode = useCallback(() => {
    setTempoModeOpen(false);
  }, []);
  const [tempoOpen, setTempoOpen] = useState(false);
  const openTempo = useCallback(() => {
    setTempoOpen(true);
  }, []);
  const closeTempo = useCallback(() => {
    setTempoOpen(false);
  }, []);
  const clickSheet = useSongClickSheet();
  const { open: openClick } = clickSheet;
  const openCountIn = useCallback(() => {
    openClick(CLICK_GROUP.countIn);
  }, [openClick]);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  return (
    <View style={[styles.screen, padding]}>
      <SongAppBar onBack={leave} onQueue={onOpenQueue} onMenu={openMenu} />
      <Body
        songId={songId}
        bottom={insets.bottom}
        meterOpen={meterOpen}
        tempoModeOpen={tempoModeOpen}
        tempoOpen={tempoOpen}
        onBack={leave}
        onCloseMeter={closeMeter}
        onCloseTempoMode={closeTempoMode}
        onCloseTempo={closeTempo}
        usePlayhead={usePlayhead}
        clickSheet={clickSheet}
        renderUpNext={renderUpNext}
      />
      <SongPlayerMenu
        songId={songId}
        visible={menuOpen}
        bottomInset={insets.bottom}
        onDismiss={closeMenu}
        onBack={leave}
        onMeter={openMeter}
        onTempoMode={openTempoMode}
        onTempoCorrection={openTempo}
        onCountIn={openCountIn}
      />
      <EndedSetlistSnackbar />
    </View>
  );
}
