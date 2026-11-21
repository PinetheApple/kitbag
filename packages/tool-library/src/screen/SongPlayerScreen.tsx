import {
  AppBar,
  Badge,
  BeatWaveform,
  Card,
  createThemedStyles,
  screenBar,
  ScrubRow,
  songPlayer,
  space,
  stemPlayer,
  type AppBarAction,
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
import { barBadge, barStatusOf } from '../logic/lockText.ts';
import { playedBpm } from '../logic/playedBpm.ts';
import type { BadgeSpec } from '../logic/rowText.ts';
import { songTitle } from '../logic/songTitle.ts';
import { frameAtTap } from '../logic/waveSeek.ts';
import type { SongPlayhead, UsePlayhead } from './playhead.ts';
import { EndedSetlistSnackbar } from './EndedSetlistSnackbar.tsx';
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
import { SongTransport } from './SongTransport.tsx';
import { useFollowQueueArrivals } from './useFollowQueueArrivals.ts';
import { useLeaveOnStop } from './useLeaveOnStop.ts';
import { useLoopHandles } from './useLoopHandles.ts';
import { NotReady } from './NotReady.tsx';

export interface SongPlayerScreenProps {
  readonly songId: number;
  readonly focused: boolean;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
  readonly usePlayhead: UsePlayhead;
  readonly renderUpNext?: RenderUpNext;
}

export type RenderUpNext = (songSec: SongPlayhead['songSec']) => ReactNode;

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  body: { flex: 1 },
  bodyContent: {
    paddingTop: stemPlayer.bodyTop,
    paddingHorizontal: space.screenInset,
    paddingBottom: stemPlayer.bodyGap,
    gap: stemPlayer.bodyGap,
  },
  bpm: { marginRight: screenBar.chipEnd },
}));

interface SongAppBarProps {
  readonly onBack: () => void;
  readonly onMenu: () => void;
}

interface BarFacts {
  readonly title: string;
  readonly artist: string | null;
  readonly bpm: number | null;
  readonly status: BadgeSpec | null;
}

// Stop closes the session while the screen is still animating out.
function useLastOpenFacts(): BarFacts {
  const open = useSongPlayer((s) => s.songId !== null);
  const title = useSongPlayer((s) => s.title);
  const artist = useSongPlayer((s) => s.artist);
  const bpm = useSongPlayer((s) => playedBpm(s.bpm, s.speed));
  const status = useSongPlayer(barStatusOf);
  const [kept, setKept] = useState<BarFacts>({ title, artist, bpm, status });
  const changed =
    kept.title !== title ||
    kept.artist !== artist ||
    kept.bpm !== bpm ||
    kept.status !== status;
  if (open && changed) setKept({ title, artist, bpm, status });
  return open ? { title, artist, bpm, status } : kept;
}

function SongAppBar({ onBack, onMenu }: SongAppBarProps) {
  const styles = useStyles();
  const { title, artist, status, bpm } = useLastOpenFacts();
  const shown = barBadge(status, bpm);
  const actions: readonly AppBarAction[] = useMemo(
    () => [{ icon: 'more', label: 'More', onPress: onMenu }],
    [onMenu],
  );
  return (
    <AppBar
      flush
      title={songTitle(title)}
      subtitle={artist ?? undefined}
      onBack={onBack}
      actions={actions}
      trailing={
        shown === null ? null : (
          <View style={styles.bpm}>
            <Badge
              label={shown.label}
              tone={shown.tone}
              {...(shown.icon === undefined ? {} : { icon: shown.icon })}
              accessibilityLabel={shown.spoken}
            />
          </View>
        )
      }
    />
  );
}

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
  readonly tempoOpen: boolean;
  readonly onBack: () => void;
  readonly onCloseMeter: () => void;
  readonly onCloseTempo: () => void;
  readonly usePlayhead: UsePlayhead;
  readonly clickSheet: SongClickSheetState;
  readonly renderUpNext: RenderUpNext | undefined;
}

function Body({
  songId,
  bottom,
  meterOpen,
  tempoOpen,
  onBack,
  onCloseMeter,
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
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        <Card>
          <SongWave playhead={playhead} />
          <ScrubRow frame={playhead} {...scrub} loopHandles={handles} />
        </Card>
        <SongLockCard songId={songId} />
        <SongClickChips onOpen={clickSheet.open} />
      </ScrollView>
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
      <SongTempoCorrection
        songId={songId}
        visible={tempoOpen}
        bottomInset={bottom}
        onClose={onCloseTempo}
      />
      <SongTransport
        playing={playhead.playing}
        bottomInset={bottom}
        upNext={renderUpNext?.(playhead.songSec)}
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
      <SongAppBar onBack={leave} onMenu={openMenu} />
      <Body
        songId={songId}
        bottom={insets.bottom}
        meterOpen={meterOpen}
        tempoOpen={tempoOpen}
        onBack={leave}
        onCloseMeter={closeMeter}
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
        onTempoCorrection={openTempo}
        onCountIn={openCountIn}
      />
      <EndedSetlistSnackbar />
    </View>
  );
}
