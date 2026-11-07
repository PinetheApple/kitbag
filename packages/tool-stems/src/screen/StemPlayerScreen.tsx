import {
  Card,
  createThemedStyles,
  EmptyState,
  PlayerDock,
  SegmentedControl,
  space,
  stemPlayer,
  textRoles,
  textStyle,
  type SegmentOption,
} from '@kitbag/core-design';
import { KB_MAX_TRACKS } from '@kitbag/core-native';
import { loopEndFrames, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { detailTabLabel } from '../logic/detailView.ts';
import { DetailPane } from './DetailPane.tsx';
import { LoopUndoSnackbar } from './LoopUndoSnackbar.tsx';
import { PlayerMenu } from './PlayerMenu.tsx';
import { ResetDialog, RetimeBar } from './RetimeBar.tsx';
import { RetimeBody } from './RetimeMode.tsx';
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

const MIX = 'mix';
const DETAILS = 'details';
type Tab = typeof MIX | typeof DETAILS;

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  main: { flex: 1 },
  bodyFlush: { paddingBottom: 0 },
  body: {
    flex: 1,
    paddingTop: stemPlayer.bodyTop,
    paddingHorizontal: space.screenInset,
    paddingBottom: stemPlayer.bodyGap,
    gap: stemPlayer.bodyGap,
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
  return (
    <PlayerDock bottomInset={bottom}>
      <Scrubber frame={frame} />
      <StemTransport playing={frame.playing} />
    </PlayerDock>
  );
}

interface PlayerTabsProps {
  readonly label: string;
  readonly picked: Tab;
  readonly onPick: (tab: Tab) => void;
}

function PlayerTabs({ label, picked, onPick }: PlayerTabsProps) {
  const options = useMemo<readonly SegmentOption<Tab>[]>(
    () => [
      { value: MIX, label: 'Mix' },
      { value: DETAILS, label },
    ],
    [label],
  );
  return (
    <SegmentedControl
      size="tab"
      options={options}
      selected={picked}
      accessibilityLabel="Player view"
      neighbourGapDp={stemPlayer.bodyGap}
      onSelect={onPick}
    />
  );
}

interface PlayerContentProps {
  readonly frame: MixerFrameValues;
  readonly picked: Tab;
  readonly onPick: (tab: Tab) => void;
}

function PlayerContent({ frame, picked, onPick }: PlayerContentProps) {
  const styles = useStyles();
  const label = useStemPlayer((s) =>
    detailTabLabel(s.sections.length > 0, s.lyrics),
  );
  const tab = label === null ? MIX : picked;
  return (
    <View style={[styles.body, tab === DETAILS && styles.bodyFlush]}>
      <SongFactChips />
      <Notices />
      {label === null ? null : (
        <PlayerTabs label={label} picked={tab} onPick={onPick} />
      )}
      {tab === MIX ? (
        <StemList progress={frame.progress} />
      ) : (
        <DetailPane songSec={frame.songSec} />
      )}
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
  const loopEnd = useStemPlayer(loopEndFrames);
  const frame = useMixerFrame(rate, frames, loopEnd);
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const [picked, setPicked] = useState<Tab>(MIX);
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
      <View style={styles.main}>
        {retiming ? (
          <View style={[styles.body, styles.bodyFlush]}>
            <RetimeBody />
          </View>
        ) : (
          <PlayerContent frame={frame} picked={picked} onPick={setPicked} />
        )}
        <LoopUndoSnackbar />
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
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const [menu, setMenu] = useState(false);
  const [askingReset, setAskingReset] = useState(false);
  if (askingReset && !retiming) setAskingReset(false);
  const askReset = useCallback(() => {
    setAskingReset(true);
  }, []);
  const closeReset = useCallback(() => {
    setAskingReset(false);
  }, []);
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
      {retiming ? (
        <RetimeBar onAskReset={askReset} />
      ) : (
        <StemAppBar onBack={onBack} onMenu={ready ? openMenu : null} />
      )}
      <Body bottom={insets.bottom} onBack={onBack} />
      <PlayerMenu
        visible={menu}
        bottomInset={insets.bottom}
        onClose={closeMenu}
      />
      {retiming && askingReset ? <ResetDialog onClose={closeReset} /> : null}
    </View>
  );
}
