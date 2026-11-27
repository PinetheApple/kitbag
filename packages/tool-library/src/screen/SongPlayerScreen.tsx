import {
  BeatWaveform,
  BridgedProvider,
  Card,
  createThemedStyles,
  PlayerScroll,
  ScrubRow,
  size,
  songPlayer,
  space,
  stemPlayer,
  useNotice,
  type ScrubFrame,
} from '@kitbag/core-design';
import {
  framesToSeconds,
  loopEndFrames,
  SongSourceContext,
  useFocusedMixerHold,
  useLiveSongPlayer,
  useLoopScrub,
  useSongHeldFrame,
  useSongPlayer,
  useSongSource,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { CLICK_GROUP } from '../logic/clickChipText.ts';
import { frameAtTap } from '../logic/waveSeek.ts';
import type { SongPlayhead, UsePlayhead } from './playhead.ts';
import { EndedSetlistSnackbar } from './EndedSetlistSnackbar.tsx';
import { SongAppBar } from './SongAppBar.tsx';
import {
  ManualTempoNotices,
  useManualTempoNotices,
} from './ManualTempoNotices.tsx';
import { SetTempoSheet } from './SetTempoSheet.tsx';
import { SongGridActions } from './SongGridActions.tsx';
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
import {
  useSetTempo,
  useSetTempoOpen,
  useTempoPreview,
} from './useSetTempo.ts';
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
  readonly onOpenQueue: () => void;
  readonly onOpenSetlist: (setlistId: number) => void;
  readonly view?: boolean;
  readonly renderMiniPlayer?: (onOpenQueue: () => void) => ReactNode;
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
  readonly setTempoOpen: boolean;
  readonly onSetTempo: () => void;
  readonly onCloseSetTempo: () => void;
  readonly onTempoSaved: (message: string) => void;
  readonly onBack: () => void;
  readonly onCloseMeter: () => void;
  readonly onCloseTempoMode: () => void;
  readonly onCloseTempo: () => void;
  readonly usePlayhead: UsePlayhead;
  readonly clickSheet: SongClickSheetState;
  readonly renderUpNext: RenderUpNext | undefined;
  readonly viewing: boolean;
  readonly dockInset: number;
}

function Body({
  songId,
  bottom,
  meterOpen,
  tempoModeOpen,
  tempoOpen,
  setTempoOpen,
  onSetTempo,
  onCloseSetTempo,
  onTempoSaved,
  onBack,
  onCloseMeter,
  onCloseTempoMode,
  onCloseTempo,
  usePlayhead,
  clickSheet,
  renderUpNext,
  viewing,
  dockInset,
}: BodyProps) {
  const styles = useStyles();
  const status = useSongPlayer((s) => s.status);
  const rate = useSongPlayer((s) => s.engineRate);
  const frames = useSongPlayer((s) => s.durationFrames);
  const loopEnd = useSongPlayer(loopEndFrames);
  const held = useSongHeldFrame(viewing);
  const playhead = usePlayhead(rate, frames, loopEnd, { heldFrame: held });
  const scrub = useLoopScrub(useSongPlayer);
  const handles = useLoopHandles();
  const tempo = useSetTempo({
    onSaved: onTempoSaved,
    onClose: onCloseSetTempo,
  });
  useTempoPreview(tempo, setTempoOpen);
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
            <SongGridActions
              onOpenClick={clickSheet.open}
              onSetTempo={onSetTempo}
            />
          </ScrollView>
        </View>
        <SongTransport
          playing={playhead.playing}
          dockInset={dockInset}
          sheetInset={bottom}
          upNext={viewing ? null : renderUpNext?.(playhead.songSec)}
        />
      </PlayerScroll>
      <SongClickSheet
        group={clickSheet.group}
        bottomInset={bottom}
        onDismiss={clickSheet.close}
      />
      {viewing ? null : (
        <SetTempoSheet
          visible={setTempoOpen}
          bottomInset={bottom}
          playhead={playhead}
          tempo={tempo}
          onClose={onCloseSetTempo}
        />
      )}
      {viewing ? null : (
        <LiveSheets
          songId={songId}
          bottom={bottom}
          meterOpen={meterOpen}
          tempoModeOpen={tempoModeOpen}
          tempoOpen={tempoOpen}
          onCloseMeter={onCloseMeter}
          onCloseTempoMode={onCloseTempoMode}
          onCloseTempo={onCloseTempo}
          playheadSeconds={playhead.songSec}
        />
      )}
    </>
  );
}

type LiveSheetsProps = Pick<
  BodyProps,
  | 'songId'
  | 'bottom'
  | 'meterOpen'
  | 'tempoModeOpen'
  | 'tempoOpen'
  | 'onCloseMeter'
  | 'onCloseTempoMode'
  | 'onCloseTempo'
> & { readonly playheadSeconds: SongPlayhead['songSec'] };

function LiveSheets({
  songId,
  bottom,
  meterOpen,
  tempoModeOpen,
  tempoOpen,
  onCloseMeter,
  onCloseTempoMode,
  onCloseTempo,
  playheadSeconds,
}: LiveSheetsProps) {
  return (
    <>
      <SongMeter
        songId={songId}
        visible={meterOpen}
        bottomInset={bottom}
        playheadSeconds={playheadSeconds}
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

type ContentProps = Omit<SongPlayerScreenProps, 'view'> & {
  readonly viewing: boolean;
};

function SongPlayerContent({
  songId,
  focused,
  insets,
  onBack,
  onOpenStemSet,
  onOpenSong,
  usePlayhead,
  renderUpNext,
  onOpenQueue,
  onOpenSetlist,
  renderMiniPlayer,
  viewing,
}: ContentProps) {
  const styles = useStyles();
  const open = useLiveSongPlayer((s) => s.open);
  const acquire = useCallback(
    () => open(songId, songPlayer.waveBars).hold,
    [open, songId],
  );
  const following = focused && !viewing;
  useFocusedMixerHold(following, acquire);
  const follow = useMemo(
    () => ({ songId, onOpenStemSet, onOpenSong }),
    [songId, onOpenStemSet, onOpenSong],
  );
  const { leave, markLeft } = useLeaveOnStop(following, onBack, songId);
  useFollowQueueArrivals(following, follow, markLeft);
  const notice = useNotice();
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
  const setTempo = useSetTempoOpen();
  const tempoNotices = useManualTempoNotices(songId);
  const { open: openClick } = clickSheet;
  const openCountIn = useCallback(() => {
    openClick(CLICK_GROUP.countIn);
  }, [openClick]);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  const docked = viewing && renderMiniPlayer !== undefined;
  return (
    <View style={[styles.screen, padding]}>
      <SongAppBar onBack={leave} onQueue={onOpenQueue} onMenu={openMenu} />
      <Body
        songId={songId}
        bottom={insets.bottom}
        meterOpen={meterOpen}
        tempoModeOpen={tempoModeOpen}
        tempoOpen={tempoOpen}
        setTempoOpen={setTempo.open}
        onSetTempo={setTempo.show}
        onCloseSetTempo={setTempo.hide}
        onTempoSaved={tempoNotices.setUndoNote}
        onBack={leave}
        onCloseMeter={closeMeter}
        onCloseTempoMode={closeTempoMode}
        onCloseTempo={closeTempo}
        usePlayhead={usePlayhead}
        clickSheet={clickSheet}
        renderUpNext={renderUpNext}
        viewing={viewing}
        dockInset={docked ? 0 : insets.bottom}
      />
      {docked ? renderMiniPlayer(onOpenQueue) : null}
      <SongPlayerMenu
        songId={songId}
        visible={menuOpen}
        bottomInset={insets.bottom}
        notice={notice}
        onDismiss={closeMenu}
        onBack={leave}
        onMeter={openMeter}
        onTempoMode={openTempoMode}
        onTempoCorrection={openTempo}
        onCountIn={openCountIn}
        onSetTempo={setTempo.show}
        onAskReanalyse={tempoNotices.onAsk}
        onUseAnalysed={tempoNotices.onUseAnalysed}
        onOpenQueue={onOpenQueue}
        onOpenSetlist={onOpenSetlist}
      />
      <ManualTempoNotices notices={tempoNotices} />
      <EndedSetlistSnackbar notice={notice} />
    </View>
  );
}

export function SongPlayerScreen({
  view = false,
  ...props
}: SongPlayerScreenProps) {
  const source = useSongSource(props.songId, view, songPlayer.waveBars);
  return (
    <BridgedProvider context={SongSourceContext} value={source}>
      <SongPlayerContent {...props} viewing={source.viewing} />
    </BridgedProvider>
  );
}
