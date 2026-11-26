import { createThemedStyles, type ScreenInsets } from '@kitbag/core-design';
import { useMediaSessions } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { PLAY_ALONG_VIEW, playAlongView } from '../logic/playAlongView.ts';
import { MIN_SESSIONS_TO_CHOOSE } from '../logic/sourceRows.ts';
import { PermissionExplainer } from './PermissionExplainer.tsx';
import { PlayAlongAppBar, type SourceChipProps } from './PlayAlongAppBar.tsx';
import { PlayAlongBody } from './PlayAlongBody.tsx';
import { PlayAlongDock } from './PlayAlongDock.tsx';
import { PlayAlongMenu } from './PlayAlongMenu.tsx';
import { pickSource } from './pickSource.ts';
import {
  useFollowedSession,
  usePlayAlong,
  useSessionWatchWhileLocked,
  useSongTempo,
  useTempoLine,
} from './playAlongHooks.ts';
import { SourceSheet } from './SourceSheet.tsx';
import { TempoSheet } from './TempoSheet.tsx';
import { useAccessFlow, type AccessFlow } from './useAccessFlow.ts';
import { useLastSeen } from './useLastSeen.ts';

type OpenSheet = 'none' | 'source' | 'tempo' | 'menu';

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
  return { sheet, close, openSource, openTempo, openMenu };
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

interface SheetsProps {
  readonly sheets: ReturnType<typeof useSheets>;
  readonly followedId: string | undefined;
  readonly bottomInset: number;
}

function PlayAlongSheets({ sheets, followedId, bottomInset }: SheetsProps) {
  const access = useMediaSessions((s) => s.access);
  const sessions = useMediaSessions((s) => s.sessions);
  const openSettings = useMediaSessions((s) => s.openSettings);
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
      <PlayAlongMenu
        visible={sheets.sheet === 'menu'}
        access={access === true}
        bottomInset={bottomInset}
        onNotificationAccess={handleAccess}
        onDismiss={close}
      />
    </>
  );
}

function usePlayAlongView(flow: AccessFlow) {
  const access = useMediaSessions((s) => s.access);
  const session = useFollowedSession();
  const lock = usePlayAlong((s) => s.lock);
  useSongTempo(session);
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
  const styles = useStyles();
  const flow = useAccessFlow();
  const sheets = useSheets();
  const source = useSourceChip(sheets.openSource);
  const { view, explaining, showsBody, session, lock } = usePlayAlongView(flow);
  const song = view === PLAY_ALONG_VIEW.song;
  const top = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);
  const bottom = useMemo(() => ({ height: insets.bottom }), [insets.bottom]);
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
        />
      ) : null}
      {song ? (
        <PlayAlongDock
          playing={session?.playing === true}
          disabled={session === undefined}
          bottomInset={insets.bottom}
        />
      ) : (
        <View style={bottom} />
      )}
      <PlayAlongSheets
        sheets={sheets}
        followedId={session?.sessionId}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
