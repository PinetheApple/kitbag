import {
  Card,
  createThemedStyles,
  EmptyState,
  size,
  space,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { KB_MAX_TRACKS } from '@kitbag/core-native';
import { secondsToFrames, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { PlayerMenu } from './PlayerMenu.tsx';
import { StemAppBar } from './StemAppBar.tsx';
import { Scrubber } from './Scrubber.tsx';
import { SongFactChips } from './SongFactChips.tsx';
import { StemList } from './StemList.tsx';
import { WAVEFORM_BARS } from './StemRowView.tsx';
import { StemTransport } from './StemTransport.tsx';
import { useMixerFrame, type MixerFrameValues } from './useMixerFrame.ts';

export interface StemPlayerScreenProps {
  readonly setId: number;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
}

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  body: {
    flex: 1,
    paddingTop: stemPlayer.bodyTop,
    paddingHorizontal: space.screenInset,
    paddingBottom: stemPlayer.bodyGap,
    gap: stemPlayer.bodyGap,
  },
  dock: {
    backgroundColor: theme.color.surface1,
    borderTopWidth: size.stroke,
    borderColor: theme.color.line,
    borderTopLeftRadius: stemPlayer.dockRadius,
    borderTopRightRadius: stemPlayer.dockRadius,
    paddingTop: stemPlayer.dockTop,
    paddingHorizontal: stemPlayer.dockH,
    gap: stemPlayer.dockGap,
  },
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

function Notices() {
  const styles = useStyles();
  const overLimit = useStemPlayer((s) => s.overLimit);
  const unloaded = useStemPlayer(
    (s) => s.stems.filter((row) => !row.loaded).length,
  );
  return (
    <>
      {overLimit > 0 ? (
        <Card
          emphasis="warning"
          statusIcon="warning"
          statusLabel="Too many stems"
        >
          <Text style={styles.note}>
            {`The mixer plays ${String(KB_MAX_TRACKS)} stems at most, so ${String(overLimit)} of this song's stems are left out.`}
          </Text>
        </Card>
      ) : null}
      {unloaded > 0 ? (
        <Card
          emphasis="danger"
          statusIcon="failure"
          statusLabel="Stems missing"
        >
          <Text style={styles.note}>
            {`${String(unloaded)} stem files could not be opened. The others play.`}
          </Text>
        </Card>
      ) : null}
    </>
  );
}

function Dock({
  frame,
  bottom,
}: {
  readonly frame: MixerFrameValues;
  readonly bottom: number;
}) {
  const styles = useStyles();
  const padding = useMemo(
    () => ({ paddingBottom: stemPlayer.dockBottom + bottom }),
    [bottom],
  );
  return (
    <View style={[styles.dock, padding]}>
      <Scrubber frame={frame} />
      <StemTransport playing={frame.playing} />
    </View>
  );
}

interface BodyProps {
  readonly bottom: number;
  readonly onBack: () => void;
}

function Body({ bottom, onBack }: BodyProps) {
  const styles = useStyles();
  const status = useStemPlayer((s) => s.status);
  const rate = useStemPlayer((s) => s.engineRate);
  const frames = useStemPlayer((s) => s.durationFrames);
  const loopEnd = useStemPlayer((s) =>
    s.loop.kind === 'on' ? secondsToFrames(s.loop.endSec, s.engineRate) : null,
  );
  const frame = useMixerFrame(rate, frames, loopEnd);
  if (status === 'failed')
    return (
      <EmptyState
        icon="stems"
        title="These stems would not open"
        reason="The song could not be read or the audio engine did not start. Go back and open it again."
        actionLabel="Back to songs"
        onAction={onBack}
      />
    );
  if (status === 'missing')
    return (
      <EmptyState
        icon="stems"
        title="This stem song is gone"
        reason="It was deleted from the library. Pick another song there."
        actionLabel="Back to songs"
        onAction={onBack}
      />
    );
  if (status !== 'ready')
    return (
      <View style={styles.body}>
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Opening the stems…
        </Text>
      </View>
    );
  return (
    <>
      <View style={styles.body}>
        <SongFactChips />
        <Notices />
        <StemList progress={frame.progress} />
      </View>
      <Dock frame={frame} bottom={bottom} />
    </>
  );
}

export function StemPlayerScreen({
  setId,
  insets,
  onBack,
}: StemPlayerScreenProps) {
  const styles = useStyles();
  const ready = useStemPlayer((s) => s.status === 'ready');
  const open = useStemPlayer((s) => s.open);
  const close = useStemPlayer((s) => s.close);
  const [menu, setMenu] = useState(false);
  const openMenu = useCallback(() => {
    setMenu(true);
  }, []);
  const closeMenu = useCallback(() => {
    setMenu(false);
  }, []);
  useEffect(() => {
    void open(setId, WAVEFORM_BARS);
    return close;
  }, [open, close, setId]);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  return (
    <View style={[styles.screen, padding]}>
      <StemAppBar onBack={onBack} onMenu={ready ? openMenu : null} />
      <Body bottom={insets.bottom} onBack={onBack} />
      <PlayerMenu
        visible={menu}
        bottomInset={insets.bottom}
        onClose={closeMenu}
      />
    </View>
  );
}
