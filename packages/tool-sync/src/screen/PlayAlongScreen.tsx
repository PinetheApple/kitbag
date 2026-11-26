import { createThemedStyles, type ScreenInsets } from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { soundChipLabel, useMediaSessions } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  PLAY_ALONG_VIEW,
  playAlongView,
  type PlayAlongView,
} from '../logic/playAlongView.ts';
import { MIN_SESSIONS_TO_CHOOSE } from '../logic/sourceRows.ts';
import { ClickSoundSheet } from './ClickSoundSheet.tsx';
import { PermissionExplainer } from './PermissionExplainer.tsx';
import { PhaseSheet } from './PhaseSheet.tsx';
import { PlayAlongAppBar, type SourceChipProps } from './PlayAlongAppBar.tsx';
import { PlayAlongBody } from './PlayAlongBody.tsx';
import { ClickDock, PlayAlongDock } from './PlayAlongDock.tsx';
import { PlayAlongMenu } from './PlayAlongMenu.tsx';
import {
  PATTERN_SHEET,
  PatternSheets,
  type PatternSheet,
} from './PatternSheets.tsx';
import { pickSource } from './pickSource.ts';
import {
  useFollowedSession,
  usePlayAlong,
  useLibraryWatch,
  useSessionWatchWhileLocked,
  useTempoLine,
} from './playAlongHooks.ts';
import { SourceSheet } from './SourceSheet.tsx';
import { TempoSheet } from './TempoSheet.tsx';
import { useAccessFlow, type AccessFlow } from './useAccessFlow.ts';
import { useLastSeen } from './useLastSeen.ts';

type OpenSheet =
  'none' | 'source' | 'tempo' | 'menu' | 'sound' | 'phase' | PatternSheet;

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
}));

export interface PlayAlongScreenProps {
  readonly insets: ScreenInsets;
  readonly onBack?: () => void;
}

function useSheets() {
  const [sheet, setSheet] = useState<OpenSheet>('none');
  const close = useCallback(() => {
    setSheet('none');
  }, []);
  const openSource = useCallback(() => {
    setSheet('source');
  }, []);
  const openTempo = useCallback(() => {
    setSheet('tempo');
  }, []);
  const openMenu = useCallback(() => {
    setSheet('menu');
  }, []);
  const openSound = useCallback(() => {
    setSheet('sound');
  }, []);
  const openPhase = useCallback(() => {
    setSheet('phase');
  }, []);
  const openMeter = useCallback(() => {
    setSheet(PATTERN_SHEET.meter);
  }, []);
  const openSubdivision = useCallback(() => {
    setSheet(PATTERN_SHEET.subdivision);
  }, []);
  return {
    sheet,
    close,
    openSource,
    openTempo,
    openMenu,
    openSound,
    openPhase,
    openMeter,
    openSubdivision,
  };
}

function useSourceChip(onOpen: () => void): SourceChipProps | null {
  const session = useFollowedSession();
  const count = useMediaSessions((s) => s.sessions.length);
  const appLabel = useLastSeen(session?.appLabel);
  const locked = usePlayAlong((s) => s.lock !== undefined);
  return useMemo(() => {
    if (appLabel === undefined || (session === undefined && !locked))
      return null;
    return {
      appLabel,
      count,
      greyed: session === undefined,
      onPress: count >= MIN_SESSIONS_TO_CHOOSE ? onOpen : null,
    };
  }, [appLabel, count, session, locked, onOpen]);
}

function patternSheet(sheet: OpenSheet): PatternSheet | null {
  return sheet === PATTERN_SHEET.meter || sheet === PATTERN_SHEET.subdivision
    ? sheet
    : null;
}

interface SheetsProps {
  readonly sheets: ReturnType<typeof useSheets>;
  readonly followedId: string | undefined;
  readonly bottomInset: number;
}

function PlayAlongSheets({ sheets, followedId, bottomInset }: SheetsProps) {
  const access = useMediaSessions((s) => s.access);
  const sessions = useMediaSessions((s) => s.sessions);
  const openSettings = useMediaSessions((s) => s.openSettings);
  const sounds = usePlayAlong((s) => s.pattern.sounds);
  const { line } = useTempoLine();
  const { close } = sheets;
  const handleAccess = useCallback(() => {
    close();
    openSettings().catch(() => undefined);
  }, [close, openSettings]);
  return (
    <>
      <SourceSheet
        visible={sheets.sheet === 'source'}
        sessions={sessions}
        followedId={followedId}
        bottomInset={bottomInset}
        onPick={pickSource}
        onDismiss={close}
      />
      <TempoSheet
        visible={sheets.sheet === 'tempo'}
        sourceWords={line.lead + line.rung}
        bottomInset={bottomInset}
        onDismiss={close}
      />
      <PatternSheets
        open={patternSheet(sheets.sheet)}
        bottomInset={bottomInset}
        onDismiss={close}
      />
      <PlayAlongMenu
        visible={sheets.sheet === 'menu'}
        access={access === true}
        soundLabel={soundChipLabel(sounds)}
        bottomInset={bottomInset}
        onClickSound={sheets.openSound}
        onNotificationAccess={handleAccess}
        onDismiss={close}
      />
      <ClickSoundSheet
        visible={sheets.sheet === 'sound'}
        bottomInset={bottomInset}
        onDismiss={close}
      />
      <PhaseSheet
        visible={sheets.sheet === 'phase'}
        bottomInset={bottomInset}
        onDismiss={close}
      />
    </>
  );
}

interface ScreenDockProps {
  readonly view: PlayAlongView;
  readonly session: MediaSessionSnapshot | undefined;
  readonly bottomInset: number;
}

function ScreenDock({ view, session, bottomInset }: ScreenDockProps) {
  const spacer = useMemo(() => ({ height: bottomInset }), [bottomInset]);
  if (view === PLAY_ALONG_VIEW.song)
    return (
      <PlayAlongDock
        playing={session?.playing === true}
        disabled={session === undefined}
        bottomInset={bottomInset}
      />
    );
  if (view === PLAY_ALONG_VIEW.nothing || view === PLAY_ALONG_VIEW.denied)
    return <ClickDock bottomInset={bottomInset} />;
  return <View style={spacer} />;
}

function usePlayAlongView(flow: AccessFlow) {
  const access = useMediaSessions((s) => s.access);
  const session = useFollowedSession();
  const lock = usePlayAlong((s) => s.lock);
  const view = playAlongView({
    access,
    askedForAccess: flow.askedForAccess,
    declined: flow.declined,
    hasSong: session !== undefined || lock !== undefined,
  });
  const explaining =
    view === PLAY_ALONG_VIEW.explainer || view === PLAY_ALONG_VIEW.stillOff;
  const showsBody = !explaining && view !== PLAY_ALONG_VIEW.checking;
  return { view, explaining, showsBody, session, lock };
}

export function PlayAlongScreen({ insets, onBack }: PlayAlongScreenProps) {
  useSessionWatchWhileLocked();
  useLibraryWatch();
  const styles = useStyles();
  const flow = useAccessFlow();
  const sheets = useSheets();
  const source = useSourceChip(sheets.openSource);
  const { view, explaining, showsBody, session, lock } = usePlayAlongView(flow);
  const song = view === PLAY_ALONG_VIEW.song;
  const top = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  return (
    <View style={[styles.screen, top]}>
      <PlayAlongAppBar
        onBack={onBack}
        source={song ? source : null}
        onMenu={showsBody ? sheets.openMenu : null}
      />
      {explaining ? (
        <PermissionExplainer
          stillOff={view === PLAY_ALONG_VIEW.stillOff}
          onOpenAccess={flow.openAccess}
          onNotNow={flow.notNow}
        />
      ) : null}
      {showsBody ? (
        <PlayAlongBody
          view={view}
          session={session}
          lock={lock}
          onExplainAgain={flow.explainAgain}
          onOpenTempo={sheets.openTempo}
          onOpenMeter={sheets.openMeter}
          onOpenSubdivision={sheets.openSubdivision}
          onOpenPhase={sheets.openPhase}
        />
      ) : null}
      <ScreenDock view={view} session={session} bottomInset={insets.bottom} />
      <PlayAlongSheets
        sheets={sheets}
        followedId={session?.sessionId}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
