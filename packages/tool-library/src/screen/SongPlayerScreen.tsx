import {
  Badge,
  BeatWaveform,
  Card,
  Chip,
  createThemedStyles,
  EmptyState,
  PlayerDock,
  PlayerTransport,
  ScreenAppBar,
  ScrubRow,
  songPlayer,
  space,
  stemPlayer,
  textRoles,
  textStyle,
  type PlayerFrame,
  type ScrubFrame,
} from '@kitbag/core-design';
import {
  bpmFact,
  loopKeyLabel,
  secondsToFrames,
  SKIP_SECONDS,
  songBadge,
  useLoopScrub,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { lockText } from '../logic/lockText.ts';
import { frameAtTap } from '../logic/waveSeek.ts';

const NO_NEIGHBOURS = {};

type UsePlayhead = (
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
) => PlayerFrame;

export interface SongPlayerScreenProps {
  readonly songId: number;
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
      durationSec={rate > 0 ? frames / rate : 0}
      onTap={onTap}
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
  const loopEnd = useSongPlayer((s) =>
    s.loop.kind === 'on' ? secondsToFrames(s.loop.endSec, s.engineRate) : null,
  );
  const playhead = usePlayhead(rate, frames, loopEnd);
  const scrub = useLoopScrub(useSongPlayer);
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
  insets,
  onBack,
  usePlayhead,
}: SongPlayerScreenProps) {
  const styles = useStyles();
  const open = useSongPlayer((s) => s.open);
  useEffect(() => open(songId, songPlayer.waveBars).close, [open, songId]);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  return (
    <View style={[styles.screen, padding]}>
      <SongAppBar onBack={onBack} />
      <Body bottom={insets.bottom} onBack={onBack} usePlayhead={usePlayhead} />
    </View>
  );
}
