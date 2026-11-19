import {
  Card,
  countLabel,
  createThemedStyles,
  EmptyState,
  PlayerDock,
  readerHiding,
  SegmentedControl,
  space,
  stemPlayer,
  textRoles,
  textStyle,
  type SegmentOption,
} from '@kitbag/core-design';
import { KB_MAX_TRACKS } from '@kitbag/core-native';
import {
  loopEndFrames,
  useFocusedMixerHold,
  useStemPlayer,
  type StemPlayerStatus,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { detailTabLabel } from '../logic/detailView.ts';
import { CLICK_SECTION, type ClickSection } from '../logic/clickView.ts';
import { hasUnsavedRetime } from '../logic/retimeView.ts';
import { ClickSheet } from './ClickSheet.tsx';
import { DetailPane } from './DetailPane.tsx';
import { ExportCancelledSnackbar, ExportNotice } from './ExportNotice.tsx';
import { ExportSheet } from './ExportSheet.tsx';
import { LoopUndoSnackbar } from './LoopUndoSnackbar.tsx';
import { PlayerMenu } from './PlayerMenu.tsx';
import { LeaveDialog, ResetDialog, RetimeBar } from './RetimeBar.tsx';
import { RetimeBody } from './RetimeMode.tsx';
import { StemAppBar } from './StemAppBar.tsx';
import { Scrubber } from './Scrubber.tsx';
import { SongFactChips } from './SongFactChips.tsx';
import { StemList } from './StemList.tsx';
import { StemMeterSheet } from './StemMeterSheet.tsx';
import { WAVEFORM_BARS } from './StemRowView.tsx';
import { StemTransport } from './StemTransport.tsx';
import { TempoSheet } from './TempoSheet.tsx';
import { useMixerFrame, type MixerFrameValues } from './useMixerFrame.ts';

export interface StemPlayerScreenProps {
  readonly setId: number;
  readonly focused: boolean;
  readonly insets: { readonly top: number; readonly bottom: number };
  readonly onBack: () => void;
}

const MIX = 'mix';
const DETAILS = 'details';
type Tab = typeof MIX | typeof DETAILS;
type RetimeAsk = 'reset' | 'leave';
type PlayerSheet = 'menu' | 'meter' | 'export';

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

function missingNote(unloaded: number, stemCount: number): string {
  if (unloaded === stemCount)
    return 'No stem files could be opened. Nothing will play.';
  return `${countLabel(unloaded, 'stem file', 'stem files')} could not be opened. The others play.`;
}

function Notices() {
  const styles = useStyles();
  const overLimit = useStemPlayer((s) => s.overLimit);
  const stemCount = useStemPlayer((s) => s.stems.length);
  const unloaded = useStemPlayer(
    (s) => s.stems.filter((row) => !row.loaded).length,
  );
  return (
    <>
      <ExportNotice />
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
          <Text style={styles.note}>{missingNote(unloaded, stemCount)}</Text>
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
  return (
    <Text accessibilityLiveRegion="polite" style={styles.note}>
      Opening the stems…
    </Text>
  );
}

function useStemFrame(): MixerFrameValues {
  const rate = useStemPlayer((s) => s.engineRate);
  const frames = useStemPlayer((s) => s.durationFrames);
  const loopEnd = useStemPlayer(loopEndFrames);
  const countEnd = useStemPlayer((s) => s.countEndFrame);
  return useMixerFrame(rate, frames, loopEnd, countEnd);
}

interface BodyProps {
  readonly bottom: number;
  readonly frame: MixerFrameValues;
  readonly onBack: () => void;
}

function Body({ bottom, frame, onBack }: BodyProps) {
  const styles = useStyles();
  const status = useStemPlayer((s) => s.status);
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const [picked, setPicked] = useState<Tab>(MIX);
  if (status !== 'ready')
    return (
      <View style={styles.body}>
        <NotReady status={status} onBack={onBack} />
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
        <ExportCancelledSnackbar />
      </View>
      <Dock frame={frame} bottom={bottom} />
    </>
  );
}

function useRetimeAsk() {
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const unsaved = useStemPlayer((s) => hasUnsavedRetime(s.retime));
  const [asking, setAsking] = useState<RetimeAsk | null>(null);
  const stale =
    asking !== null && (!retiming || (asking === 'leave' && !unsaved));
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

interface ClickSheetOpen {
  readonly kind: 'click';
  readonly section: ClickSection;
}

const TEMPO_SHEET = { kind: 'tempo' } as const;

type OpenSheet = PlayerSheet | ClickSheetOpen | typeof TEMPO_SHEET;

const clickSectionOf = (sheet: OpenSheet | null) =>
  typeof sheet === 'object' && sheet?.kind === 'click' ? sheet.section : null;

function usePlayerSheet(retiming: boolean) {
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  if (sheet !== null && retiming) setSheet(null);
  const handlers = useMemo(() => {
    const opener = (next: OpenSheet | null) => () => {
      setSheet(next);
    };
    return {
      openMenu: opener('menu'),
      openMeter: opener('meter'),
      openExport: opener('export'),
      openTempo: opener(TEMPO_SHEET),
      openClick: (section: ClickSection) => {
        setSheet({ kind: 'click', section });
      },
      closeSheet: opener(null),
    };
  }, []);
  return { sheet, ...handlers };
}

interface PlayerSheetsProps {
  readonly sheet: OpenSheet | null;
  readonly bottomInset: number;
  readonly playhead: MixerFrameValues['songSec'];
  readonly onMeter: () => void;
  readonly onExport: () => void;
  readonly onTempo: () => void;
  readonly onClick: (section: ClickSection) => void;
  readonly onClose: () => void;
}

function OpenClickSheet({
  sheet,
  bottomInset,
  onClose,
}: Pick<PlayerSheetsProps, 'sheet' | 'bottomInset' | 'onClose'>) {
  const section = clickSectionOf(sheet);
  return (
    <ClickSheet
      visible={section !== null}
      section={section ?? CLICK_SECTION.grouping}
      bottomInset={bottomInset}
      onClose={onClose}
    />
  );
}

function PlayerSheets(props: PlayerSheetsProps) {
  const { sheet, bottomInset, onClose } = props;
  return (
    <>
      <PlayerMenu
        visible={sheet === 'menu'}
        bottomInset={bottomInset}
        onClose={onClose}
        onMeter={props.onMeter}
        onExport={props.onExport}
        onTempo={props.onTempo}
        onClick={props.onClick}
      />
      <StemMeterSheet
        visible={sheet === 'meter'}
        bottomInset={bottomInset}
        playhead={props.playhead}
        onClose={onClose}
      />
      <TempoSheet
        visible={sheet === TEMPO_SHEET}
        bottomInset={bottomInset}
        onClose={onClose}
      />
      <OpenClickSheet {...props} />
      <ExportSheet
        visible={sheet === 'export'}
        bottomInset={bottomInset}
        onClose={onClose}
      />
    </>
  );
}

export function StemPlayerScreen({
  setId,
  focused,
  insets,
  onBack,
}: StemPlayerScreenProps) {
  const styles = useStyles();
  const ready = useStemPlayer((s) => s.status === 'ready');
  const acquireSong = useStemPlayer((s) => s.acquireSong);
  const { retiming, shown, askReset, askLeave, closeAsk } = useRetimeAsk();
  const sheets = usePlayerSheet(retiming);
  const frame = useStemFrame();
  const acquire = useCallback(
    () => acquireSong(setId, WAVEFORM_BARS),
    [acquireSong, setId],
  );
  useFocusedMixerHold(focused, acquire);
  const padding = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  const dialogOpen = shown !== null;
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
          <StemAppBar onBack={onBack} onMenu={ready ? sheets.openMenu : null} />
        )}
        <Body bottom={insets.bottom} frame={frame} onBack={onBack} />
      </View>
      <PlayerSheets
        sheet={sheets.sheet}
        bottomInset={insets.bottom}
        playhead={frame.songSec}
        onMeter={sheets.openMeter}
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
