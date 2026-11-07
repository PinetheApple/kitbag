import {
  Badge,
  BeatWaveform,
  Card,
  Chip,
  createThemedStyles,
  EmptyState,
  PlayerDock,
  PlayPauseButton,
  ScreenAppBar,
  ScrubRow,
  songPlayer,
  space,
  stemPlayer,
  textRoles,
  textStyle,
  TransportKey,
  type ScrubFrame,
} from '@kitbag/core-design';
import {
  bpmFact,
  formatClock,
  formatClockSeconds,
  loopKeyLabel,
  loopMarks,
  loopNote,
  secondsToFrames,
  SKIP_SECONDS,
  songBadge,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { lockText } from '../logic/lockText.ts';
import { frameAtTap } from '../logic/waveSeek.ts';
import type { SongFrameValues, UseSongFrame } from './songFrame.ts';

export const SONG_WAVE_BARS = songPlayer.waveBars;

const NO_NEIGHBOURS = {};

export interface SongPlayerScreenProps {
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
  readonly useFrame: UseSongFrame;
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
  title: { ...textStyle(textRoles.songTitle), color: theme.color.text },
  artist: { ...textStyle(textRoles.songArtist), color: theme.color.text2 },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: songPlayer.lockGap,
  },
  lockText: { flex: 1, minWidth: 0 },
  lockTitle: { ...textStyle(textRoles.listTitle), color: theme.color.text },
  lockDetail: { ...textStyle(textRoles.listFacts), color: theme.color.text2 },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemPlayer.transportGap,
  },
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

function SongAppBar({ onBack }: { readonly onBack: () => void }) {
  const styles = useStyles();
  const title = useSongPlayer((s) => s.title);
  const artist = useSongPlayer((s) => s.artist);
  const bpm = bpmFact(useSongPlayer((s) => s.bpm));
  const badge =
    bpm === null ? null : (
      <Badge label={bpm.text} accessibilityLabel={bpm.spoken} />
    );
  return (
    <ScreenAppBar onBack={onBack} trailing={badge}>
      <Text style={styles.title} numberOfLines={1}>
        {title === '' ? 'Song' : title}
      </Text>
      {artist === null ? null : (
        <Text style={styles.artist} numberOfLines={1}>
          {artist}
        </Text>
      )}
    </ScreenAppBar>
  );
}

function SongWave({ frame }: { readonly frame: ScrubFrame }) {
  const envelope = useSongPlayer((s) => s.envelope);
  const beats = useSongPlayer((s) => s.beats);
  const downbeats = useSongPlayer((s) => s.downbeats);
  const frames = useSongPlayer((s) => s.durationFrames);
  const rate = useSongPlayer((s) => s.engineRate);
  const seek = useSongPlayer((s) => s.seek);
  const { hold } = frame;
  const onTap = useCallback(
    (x: number, width: number) => {
      const target = frameAtTap(x, width, frames);
      if (target === null) return;
      hold(target / frames);
      seek(target);
    },
    [frames, hold, seek],
  );
  return (
    <BeatWaveform
      envelope={envelope}
      progress={frame.progress}
      beats={beats}
      downbeats={downbeats}
      durationSec={rate > 0 ? frames / rate : 0}
      onTap={onTap}
    />
  );
}

function SongScrubber({ frame }: { readonly frame: ScrubFrame }) {
  const frames = useSongPlayer((s) => s.durationFrames);
  const rate = useSongPlayer((s) => s.engineRate);
  const loop = useSongPlayer((s) => s.loop);
  const failure = useSongPlayer((s) => s.loopFailure);
  const scrub = useSongPlayer((s) => s.scrub);
  const cancelScrub = useSongPlayer((s) => s.cancelScrub);
  const seek = useSongPlayer((s) => s.seek);
  const total = formatClock(frames, rate);
  const spokenPosition = useCallback(
    (second: number) => `${formatClockSeconds(second)} of ${total}`,
    [total],
  );
  return (
    <ScrubRow
      frame={frame}
      durationFrames={frames}
      total={total}
      spokenPosition={spokenPosition}
      marks={loopMarks(loop, rate, frames)}
      note={loopNote(loop, failure)}
      onScrub={scrub}
      onCancel={cancelScrub}
      onSeek={seek}
    />
  );
}

function LockCard() {
  const styles = useStyles();
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
    <View style={styles.lock}>
      <View style={styles.lockText}>
        <Text style={styles.lockTitle}>{text.title}</Text>
        <Text style={styles.lockDetail}>{text.detail}</Text>
      </View>
      {text.available ? (
        <Chip
          label={click ? 'CLICK ON' : 'CLICK OFF'}
          active={click}
          accessibilityLabel={
            click ? 'Stop the click' : 'Click along on the song grid'
          }
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
  readonly playing: SongFrameValues['playing'];
}) {
  const styles = useStyles();
  const loop = useSongPlayer((s) => s.loop);
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const skip = useSongPlayer((s) => s.skip);
  const markLoop = useSongPlayer((s) => s.markLoop);
  const back = useCallback(() => {
    skip(-SKIP_SECONDS);
  }, [skip]);
  const forward = useCallback(() => {
    skip(SKIP_SECONDS);
  }, [skip]);
  const onLoop = useCallback(() => {
    void markLoop();
  }, [markLoop]);
  return (
    <View style={styles.transport}>
      <TransportKey
        size="dock"
        icon="repeat"
        selected={loop.kind !== 'off'}
        accessibilityLabel={loopKeyLabel(loop)}
        onPress={onLoop}
      />
      <TransportKey
        size="dock"
        icon="skipBack"
        accessibilityLabel={`Back ${String(SKIP_SECONDS)} seconds`}
        onPress={back}
      />
      <PlayPauseButton
        size="dock"
        playing={playing}
        playLabel="Play"
        pauseLabel="Pause"
        onPress={togglePlay}
      />
      <TransportKey
        size="dock"
        icon="skipForward"
        accessibilityLabel={`Forward ${String(SKIP_SECONDS)} seconds`}
        onPress={forward}
      />
    </View>
  );
}

interface BodyProps {
  readonly bottom: number;
  readonly onBack: () => void;
  readonly useFrame: UseSongFrame;
}

function Body({ bottom, onBack, useFrame }: BodyProps) {
  const styles = useStyles();
  const status = useSongPlayer((s) => s.status);
  const rate = useSongPlayer((s) => s.engineRate);
  const frames = useSongPlayer((s) => s.durationFrames);
  const loopEnd = useSongPlayer((s) =>
    s.loop.kind === 'on' ? secondsToFrames(s.loop.endSec, s.engineRate) : null,
  );
  const frame = useFrame(rate, frames, loopEnd);
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
  if (status !== 'ready')
    return (
      <View style={styles.bodyContent}>
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Opening the song…
        </Text>
      </View>
    );
  return (
    <>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        <Card>
          <SongWave frame={frame} />
          <SongScrubber frame={frame} />
        </Card>
        <LockCard />
      </ScrollView>
      <PlayerDock bottom={bottom}>
        <SongTransport playing={frame.playing} />
      </PlayerDock>
    </>
  );
}

export function SongPlayerScreen({
  insets,
  onBack,
  useFrame,
}: SongPlayerScreenProps) {
  const styles = useStyles();
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  return (
    <View style={[styles.screen, padding]}>
      <SongAppBar onBack={onBack} />
      <Body bottom={insets.bottom} onBack={onBack} useFrame={useFrame} />
    </View>
  );
}
