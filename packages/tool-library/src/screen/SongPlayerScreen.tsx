import {
  AppBar,
  Badge,
  BeatWaveform,
  Button,
  Card,
  Chip,
  createThemedStyles,
  EmptyState,
  PlayerDock,
  PlayerTransport,
  screenBar,
  ScrubRow,
  Sheet,
  songPlayer,
  space,
  stemPlayer,
  textRoles,
  textStyle,
  useTextScaled,
  type AppBarAction,
  type PlayerFrame,
  type ScrubFrame,
} from '@kitbag/core-design';
import {
  bpmFact,
  clickKeyLabel,
  framesToSeconds,
  loopEndFrames,
  loopKeyLabel,
  SKIP_SECONDS,
  songBadge,
  useFocusedMixerHold,
  useLoopScrub,
  useSongLibrary,
  useSongPlayer,
  type StemPlayerStatus,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { lockText } from '../logic/lockText.ts';
import { songTitle } from '../logic/songTitle.ts';
import { frameAtTap } from '../logic/waveSeek.ts';
import type { UsePlayhead } from './playhead.ts';

const NO_NEIGHBOURS = {};

export interface SongPlayerScreenProps {
  readonly songId: number;
  readonly focused: boolean;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
  readonly usePlayhead: UsePlayhead;
}

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  body: { flex: 1 },
  bodyContent: {
    paddingTop: stemPlayer.bodyTop,
    paddingHorizontal: space.screenInset,
    paddingBottom: stemPlayer.bodyGap,
    gap: stemPlayer.bodyGap,
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: songPlayer.lockGap,
  },
  lockStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  lockText: { flex: 1, minWidth: 0 },
  lockTextStacked: { alignSelf: 'stretch' },
  bpm: { marginRight: screenBar.chipEnd },
  lockTitle: { ...textStyle(textRoles.listTitle), color: theme.color.text },
  lockDetail: { ...textStyle(textRoles.listFacts), color: theme.color.text2 },
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
  menu: { gap: space.controlGap },
}));

interface PlayerMenuProps {
  readonly songId: number;
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onBack: () => void;
}

function PlayerMenu({
  songId,
  visible,
  bottomInset,
  onDismiss,
  onBack,
}: PlayerMenuProps) {
  const styles = useStyles();
  const title = useSongPlayer((s) => s.title);
  const close = useSongPlayer((s) => s.close);
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const stop = useCallback(() => {
    onDismiss();
    onBack();
    close();
  }, [onDismiss, onBack, close]);
  const reanalyse = useCallback(() => {
    onDismiss();
    void reanalyze(songId);
  }, [onDismiss, reanalyze, songId]);
  return (
    <Sheet
      visible={visible}
      title={songTitle(title)}
      dismissLabel="Close the menu"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <View style={styles.menu}>
        <Button label="Stop" variant="tonal" onPress={stop} />
        <Button label="Re-analyse" variant="tonal" onPress={reanalyse} />
      </View>
    </Sheet>
  );
}

interface SongAppBarProps {
  readonly onBack: () => void;
  readonly onMenu: () => void;
}

interface BarFacts {
  readonly title: string;
  readonly artist: string | null;
  readonly bpm: number | null;
}

// Stop closes the session while the screen is still animating out.
function useFactsWhileOpen(): BarFacts {
  const open = useSongPlayer((s) => s.songId !== null);
  const title = useSongPlayer((s) => s.title);
  const artist = useSongPlayer((s) => s.artist);
  const bpm = useSongPlayer((s) => s.bpm);
  const [kept, setKept] = useState<BarFacts>({ title, artist, bpm });
  const changed =
    kept.title !== title || kept.artist !== artist || kept.bpm !== bpm;
  if (open && changed) setKept({ title, artist, bpm });
  return open ? { title, artist, bpm } : kept;
}

function SongAppBar({ onBack, onMenu }: SongAppBarProps) {
  const styles = useStyles();
  const facts = useFactsWhileOpen();
  const { title, artist } = facts;
  const bpm = bpmFact(facts.bpm);
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
        bpm === null ? null : (
          <View style={styles.bpm}>
            <Badge label={bpm.text} accessibilityLabel={bpm.spoken} />
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

function LockCard() {
  const styles = useStyles();
  const scaled = useTextScaled();
  const click = useSongPlayer((s) => s.click);
  const hasGrid = useSongPlayer((s) => s.beats.length > 0);
  const analysisStatus = useSongPlayer((s) => s.analysisStatus);
  const bpm = bpmFact(useSongPlayer((s) => s.bpm));
  const toggleClick = useSongPlayer((s) => s.toggleClick);
  const onToggle = useCallback(() => {
    void toggleClick();
  }, [toggleClick]);
  const text = lockText(
    songBadge({ analysisStatus, hasGrid }),
    click,
    bpm?.text ?? null,
  );
  const row = (
    <View style={[styles.lock, scaled && styles.lockStacked]}>
      <View style={scaled ? styles.lockTextStacked : styles.lockText}>
        <Text style={styles.lockTitle}>{text.title}</Text>
        <Text style={styles.lockDetail}>{text.detail}</Text>
      </View>
      {text.available ? (
        <Chip
          label={click ? 'CLICK ON' : 'CLICK OFF'}
          active={click}
          accessibilityLabel={clickKeyLabel(click)}
          neighbourGapDp={NO_NEIGHBOURS}
          onPress={onToggle}
        />
      ) : null}
    </View>
  );
  return click ? <Card emphasis="activeGroup">{row}</Card> : <Card>{row}</Card>;
}

function SongTransport({
  playing,
}: {
  readonly playing: PlayerFrame['playing'];
}) {
  const loop = useSongPlayer((s) => s.loop);
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const skip = useSongPlayer((s) => s.skip);
  const markLoop = useSongPlayer((s) => s.markLoop);
  const onLoop = useCallback(() => {
    void markLoop();
  }, [markLoop]);
  return (
    <PlayerTransport
      playing={playing}
      loopActive={loop.kind !== 'off'}
      loopLabel={loopKeyLabel(loop)}
      skipSeconds={SKIP_SECONDS}
      onLoop={onLoop}
      onSkip={skip}
      onTogglePlay={togglePlay}
    />
  );
}

function NotReady({
  status,
  onBack,
}: {
  readonly status: StemPlayerStatus;
  readonly onBack: () => void;
}) {
  const styles = useStyles();
  if (status === 'failed')
    return (
      <EmptyState
        icon="song"
        title="This song would not play"
        reason="The file could not be read, its format may not be supported, or the audio engine did not start."
        actionLabel="Back to songs"
        onAction={onBack}
      />
    );
  if (status === 'missing')
    return (
      <EmptyState
        icon="song"
        title="This song is gone"
        reason="It was deleted from the library. Pick another song there."
        actionLabel="Back to songs"
        onAction={onBack}
      />
    );
  if (status === 'idle') return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.note}>
      Opening the song…
    </Text>
  );
}

interface BodyProps {
  readonly bottom: number;
  readonly onBack: () => void;
  readonly usePlayhead: UsePlayhead;
}

function Body({ bottom, onBack, usePlayhead }: BodyProps) {
  const styles = useStyles();
  const status = useSongPlayer((s) => s.status);
  const rate = useSongPlayer((s) => s.engineRate);
  const frames = useSongPlayer((s) => s.durationFrames);
  const loopEnd = useSongPlayer(loopEndFrames);
  const playhead = usePlayhead(rate, frames, loopEnd);
  const scrub = useLoopScrub(useSongPlayer);
  if (status !== 'ready')
    return (
      <View style={styles.bodyContent}>
        <NotReady status={status} onBack={onBack} />
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
          <ScrubRow frame={playhead} {...scrub} />
        </Card>
        <LockCard />
      </ScrollView>
      <PlayerDock bottomInset={bottom}>
        <SongTransport playing={playhead.playing} />
      </PlayerDock>
    </>
  );
}

export function SongPlayerScreen({
  songId,
  focused,
  insets,
  onBack,
  usePlayhead,
}: SongPlayerScreenProps) {
  const styles = useStyles();
  const open = useSongPlayer((s) => s.open);
  const acquire = useCallback(
    () => open(songId, songPlayer.waveBars).hold,
    [open, songId],
  );
  useFocusedMixerHold(focused, acquire);
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  return (
    <View style={[styles.screen, padding]}>
      <SongAppBar onBack={onBack} onMenu={openMenu} />
      <Body bottom={insets.bottom} onBack={onBack} usePlayhead={usePlayhead} />
      <PlayerMenu
        songId={songId}
        visible={menuOpen}
        bottomInset={insets.bottom}
        onDismiss={closeMenu}
        onBack={onBack}
      />
    </View>
  );
}
