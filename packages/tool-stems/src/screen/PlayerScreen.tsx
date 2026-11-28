import {
  BridgedProvider,
  createThemedStyles,
  EmptyState,
  PlayerDock,
  readerHiding,
  SegmentedControl,
  space,
  stemPlayer,
  type Notice,
  type SegmentOption,
} from '@kitbag/core-design';
import {
  loopEndFrames,
  StemSourceContext,
  useFocusedMixerHold,
  useLiveStemPlayer,
  useStemHeldFrame,
  useStemPlayer,
  useStemSource,
  useStemViewing,
  type StemPlayerStatus,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useArrivalFollow, useRouteAcquire } from './advanceFollow.ts';
import { detailTabLabel } from '../logic/detailView.ts';
import { hasUnsavedRetime } from '../logic/retimeView.ts';
import { DetailPane } from './DetailPane.tsx';
import {
  PlayerLayout,
  PlayerOverlays,
  RetimeLayout,
  useDockHeight,
} from './PlayerLayouts.tsx';
import { Notices, useNoteStyles } from './PlayerNotices.tsx';
import { PlayerSheets } from './PlayerSheets.tsx';
import { useCarriedSkipNotice, useQueueActions } from './queueActions.tsx';
import { LeaveDialog, ResetDialog, RetimeBar } from './RetimeBar.tsx';
import { RetimeBody } from './RetimeMode.tsx';
import { StemAppBar } from './StemAppBar.tsx';
import { Scrubber } from './Scrubber.tsx';
import { SongFactChips } from './SongFactChips.tsx';
import { SpeedKeyControls } from './SpeedKeyControls.tsx';
import { StemList } from './StemList.tsx';
import { WAVEFORM_BARS } from './StemRowView.tsx';
import { StemTransport } from './StemTransport.tsx';
import { UpNextRow } from './UpNextRow.tsx';
import { usePlayerRoutes, useStemPresses } from './playerRoutes.ts';
import { usePlayerSheet } from './usePlayerSheet.ts';
import { useMixerFrame, type MixerFrameValues } from './useMixerFrame.ts';

export interface StemPlayerScreenProps {
  readonly setId: number;
  readonly focused: boolean;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
  readonly onOpenMetronome: () => void;
  readonly onOpenSetlist: (setlistId: number) => void;
  readonly view?: boolean;
  readonly renderMiniPlayer?: (onOpenQueue: () => void) => ReactNode;
}

const MIX = 'mix';
const DETAILS = 'details';
type Tab = typeof MIX | typeof DETAILS;
type RetimeAsk = 'reset' | 'leave';

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  main: { flex: 1 },
  bodyFlush: { paddingBottom: 0 },
  body: {
    flexGrow: 1,
    paddingTop: stemPlayer.bodyTop,
    paddingHorizontal: space.screenInset,
    paddingBottom: stemPlayer.bodyGap,
    gap: stemPlayer.bodyGap,
  },
}));

interface DockProps {
  readonly frame: MixerFrameValues;
  readonly bottom: number;
  readonly onOpenUpNext: () => void;
  readonly onSpeedKey: () => void;
}

function Dock({ frame, bottom, onOpenUpNext, onSpeedKey }: DockProps) {
  const presses = useStemPresses();
  const viewing = useStemViewing();
  return (
    <PlayerDock bottomInset={bottom}>
      {viewing ? null : (
        <UpNextRow
          songSec={frame.songSec}
          onOpenSheet={onOpenUpNext}
          {...presses}
        />
      )}
      <Scrubber frame={frame} />
      <SpeedKeyControls onOpen={onSpeedKey} />
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
  readonly onSetTempo: () => void;
  readonly picked: Tab;
  readonly onPick: (tab: Tab) => void;
}

function PlayerContent({
  frame,
  onSetTempo,
  picked,
  onPick,
}: PlayerContentProps) {
  const styles = useStyles();
  const label = useStemPlayer((s) =>
    detailTabLabel(s.sections.length > 0, s.lyrics),
  );
  const tab = label === null ? MIX : picked;
  return (
    <View style={[styles.body, tab === DETAILS && styles.bodyFlush]}>
      <SongFactChips onSetTempo={onSetTempo} />
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

function NotReady({
  status,
  onBack,
}: {
  readonly status: StemPlayerStatus;
  readonly onBack: () => void;
}) {
  const noteStyles = useNoteStyles();
  if (status === 'failed')
    return (
      <EmptyState
        icon="stems"
        title="These stems would not open"
        reason="The song could not be read or the audio engine did not start. Go back and open it again."
        action={{ label: 'Back to songs', onPress: onBack }}
      />
    );
  if (status === 'missing')
    return (
      <EmptyState
        icon="stems"
        title="This stem song is gone"
        reason="It was deleted from the library. Pick another song there."
        action={{ label: 'Back to songs', onPress: onBack }}
      />
    );
  return (
    <Text accessibilityLiveRegion="polite" style={noteStyles.note}>
      Opening the stems…
    </Text>
  );
}

function useStemFrame(viewing: boolean): MixerFrameValues {
  const rate = useStemPlayer((s) => s.engineRate);
  const frames = useStemPlayer((s) => s.durationFrames);
  const loopEnd = useStemPlayer(loopEndFrames);
  const countEnd = useStemPlayer((s) => s.countEndFrame);
  const held = useStemHeldFrame(viewing);
  return useMixerFrame(rate, frames, loopEnd, {
    countEndFrame: countEnd,
    heldFrame: held,
  });
}

interface BodyProps {
  readonly bottom: number;
  readonly frame: MixerFrameValues;
  readonly onBack: () => void;
  readonly onOpenUpNext: () => void;
  readonly notice: Notice;
  readonly onSpeedKey: () => void;
  readonly onSetTempo: () => void;
}

function Body({
  bottom,
  frame,
  onBack,
  onOpenUpNext,
  notice,
  onSpeedKey,
  onSetTempo,
}: BodyProps) {
  const styles = useStyles();
  const status = useStemPlayer((s) => s.status);
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const [picked, setPicked] = useState<Tab>(MIX);
  const { dockHeight, onDockLayout } = useDockHeight();
  if (status !== 'ready')
    return (
      <View style={styles.body}>
        <NotReady status={status} onBack={onBack} />
      </View>
    );
  const dock = (
    <Dock
      frame={frame}
      bottom={bottom}
      onOpenUpNext={onOpenUpNext}
      onSpeedKey={onSpeedKey}
    />
  );
  return (
    <View style={styles.main}>
      {retiming ? (
        <RetimeLayout dock={dock} onDockLayout={onDockLayout}>
          <View style={[styles.body, styles.bodyFlush]}>
            <RetimeBody />
          </View>
        </RetimeLayout>
      ) : (
        <PlayerLayout dock={dock} onDockLayout={onDockLayout}>
          <PlayerContent
            frame={frame}
            onSetTempo={onSetTempo}
            picked={picked}
            onPick={setPicked}
          />
        </PlayerLayout>
      )}
      <PlayerOverlays notice={notice} dockHeight={dockHeight} />
    </View>
  );
}

function useRetimeAsk(focused: boolean) {
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const unsaved = useStemPlayer((s) => hasUnsavedRetime(s.retime));
  const [asking, setAsking] = useState<RetimeAsk | null>(null);
  const stale =
    asking !== null &&
    (!focused || !retiming || (asking === 'leave' && !unsaved));
  if (stale) setAsking(null);
  const askReset = useCallback(() => {
    setAsking('reset');
  }, []);
  const askLeave = useCallback(() => {
    setAsking('leave');
  }, []);
  const closeAsk = useCallback(() => {
    setAsking(null);
  }, []);
  const shown = stale ? null : asking;
  return { retiming, shown, askReset, askLeave, closeAsk };
}

type ContentProps = Omit<StemPlayerScreenProps, 'view'> & {
  readonly viewing: boolean;
};

function StemPlayerContent({
  setId,
  focused,
  insets,
  onBack,
  onOpenStemSet,
  onOpenSong,
  onOpenMetronome,
  onOpenSetlist,
  renderMiniPlayer,
  viewing,
}: ContentProps) {
  const styles = useStyles();
  const { notice, routes } = usePlayerRoutes(
    onOpenStemSet,
    onOpenSong,
    onOpenMetronome,
  );
  useCarriedSkipNotice(notice.showMessage);
  const following = !viewing;
  useArrivalFollow(following, setId, routes);
  const ready = useStemPlayer((s) => s.status === 'ready');
  const acquireSong = useLiveStemPlayer((s) => s.acquireSong);
  const { retiming, shown, askReset, askLeave, closeAsk } =
    useRetimeAsk(focused);
  const shownSet = useStemPlayer((s) => s.setId);
  const sheets = usePlayerSheet(retiming, shownSet);
  const queue = useQueueActions(
    notice,
    sheets.closeSheet,
    onOpenSetlist,
    sheets.openUpNext,
  );
  const frame = useStemFrame(viewing);
  const acquireAt = useCallback(
    (id: number) => acquireSong(id, WAVEFORM_BARS),
    [acquireSong],
  );
  const acquire = useRouteAcquire(setId, acquireAt);
  useFocusedMixerHold(focused && !viewing, acquire);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  const dialogOpen = shown !== null;
  const docked = viewing && renderMiniPlayer !== undefined;
  return (
    <View style={[styles.screen, padding]}>
      <View
        style={styles.main}
        collapsable={false}
        {...readerHiding(dialogOpen)}
      >
        {retiming ? (
          <RetimeBar onAskReset={askReset} onAskLeave={askLeave} />
        ) : (
          <StemAppBar
            onBack={onBack}
            onQueue={ready ? sheets.openUpNext : null}
            onMenu={ready ? sheets.openMenu : null}
          />
        )}
        <Body
          bottom={docked ? 0 : insets.bottom}
          frame={frame}
          onBack={onBack}
          onOpenUpNext={sheets.openUpNext}
          notice={notice}
          onSpeedKey={sheets.openSpeedKey}
          onSetTempo={sheets.openSetTempo}
        />
        {docked ? renderMiniPlayer(sheets.openUpNext) : null}
      </View>
      <PlayerSheets
        routes={routes}
        notice={notice}
        queue={queue.presses}
        onAddToSetlist={sheets.openSetlists}
        onAddedToSetlist={queue.added}
        onLeftSetlist={queue.leftSetlist}
        sheet={sheets.sheet}
        bottomInset={insets.bottom}
        frame={frame}
        viewing={viewing}
        onMeter={sheets.openMeter}
        onSetTempo={sheets.openSetTempo}
        onExport={sheets.openExport}
        onTempo={sheets.openTempo}
        onClick={sheets.openClick}
        onClose={sheets.closeSheet}
      />
      {shown === 'reset' ? <ResetDialog onClose={closeAsk} /> : null}
      {shown === 'leave' ? <LeaveDialog onClose={closeAsk} /> : null}
    </View>
  );
}

export function PlayerScreen({
  view = false,
  ...props
}: StemPlayerScreenProps) {
  const source = useStemSource(props.setId, view, WAVEFORM_BARS);
  return (
    <BridgedProvider context={StemSourceContext} value={source}>
      <StemPlayerContent {...props} viewing={source.viewing} />
    </BridgedProvider>
  );
}
