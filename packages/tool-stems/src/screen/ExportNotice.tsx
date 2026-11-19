import {
  Button,
  Card,
  createThemedStyles,
  Icon,
  LinearProgress,
  Snackbar,
  snackbar,
  space,
  textRoles,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import {
  EXPORT_CANCELLED,
  EXPORT_SHARE_FAILED,
  EXPORT_UNSHARED,
  exportFailureCopy,
  megabytes,
  useStemPlayer,
  type ExportCopy,
  type ExportFailure,
  type ExportSong,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { runningBody } from '../logic/exportView.ts';
import { useMixdownProgress } from './useMixdownProgress.ts';

const useStyles = createThemedStyles((theme) => ({
  stack: { gap: space.chipGap },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
  title: {
    ...textStyle(textRoles.sheetTitle),
    color: theme.color.text,
    flex: 1,
  },
  percent: {
    ...textStyle({ ...textRoles.songChipTitle, tabular: true }),
    color: theme.color[theme.accentInk],
  },
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
    marginTop: space.rowGap,
  },
}));

function useOtherSong(song: ExportSong): string | null {
  const openId = useStemPlayer((s) => s.setId);
  return openId === song.setId ? null : song.title;
}

function CardText({ copy }: { readonly copy: ExportCopy }) {
  const styles = useStyles();
  return (
    <>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.note}>{copy.body}</Text>
    </>
  );
}

function RunningCard({ song }: { readonly song: ExportSong }) {
  const styles = useStyles();
  const theme = useTheme();
  const percent = useMixdownProgress(true);
  const cancelExport = useStemPlayer((s) => s.cancelExport);
  const otherSong = useOtherSong(song);
  return (
    <Card emphasis="activeGroup">
      <View style={styles.stack}>
        <View style={styles.head}>
          <Icon name="exportMix" color={theme.accentInk} />
          <Text style={styles.title}>Exporting mix</Text>
          <Text style={styles.percent}>{`${String(percent)}%`}</Text>
        </View>
        <LinearProgress
          percent={percent}
          accessibilityLabel="Export progress"
        />
        <Text style={styles.note}>{runningBody(otherSong)}</Text>
        <View style={styles.actions}>
          <Button
            variant="ghost"
            size="prompt"
            label="Cancel"
            accessibilityLabel="Cancel the export"
            onPress={cancelExport}
          />
        </View>
      </View>
    </Card>
  );
}

function useShare() {
  const shareExport = useStemPlayer((s) => s.shareExport);
  return useCallback(() => {
    void shareExport();
  }, [shareExport]);
}

interface FileCardProps {
  readonly fileName: string;
  readonly bytes: number;
}

function ReadyCard({ fileName, bytes }: FileCardProps) {
  const styles = useStyles();
  const share = useShare();
  const dismissExport = useStemPlayer((s) => s.dismissExport);
  const copy = {
    title: 'Mix ready',
    body: `${fileName} · ${megabytes(bytes)}`,
  };
  return (
    <Card emphasis="success" statusIcon="success" statusLabel="Done">
      <View style={styles.stack}>
        <CardText copy={copy} />
        <View style={styles.actions}>
          <Button
            variant="ghost"
            size="prompt"
            icon="share"
            label="Share"
            accessibilityLabel="Share the mix"
            onPress={share}
          />
          <Button
            variant="ghost"
            size="prompt"
            label="Dismiss"
            onPress={dismissExport}
          />
        </View>
      </View>
    </Card>
  );
}

function UnsharedCard({ noTarget }: { readonly noTarget: boolean }) {
  const styles = useStyles();
  const share = useShare();
  const dismissExport = useStemPlayer((s) => s.dismissExport);
  return (
    <Card emphasis="warning" statusIcon="warning" statusLabel="Not shared">
      <View style={styles.stack}>
        <CardText copy={noTarget ? EXPORT_UNSHARED : EXPORT_SHARE_FAILED} />
        <View style={styles.actions}>
          <Button
            variant="ghost"
            size="prompt"
            icon="share"
            label="Share again"
            onPress={share}
          />
          <Button
            variant="ghost"
            size="prompt"
            label="Dismiss"
            onPress={dismissExport}
          />
        </View>
      </View>
    </Card>
  );
}

interface FailedCardProps {
  readonly song: ExportSong;
  readonly failure: ExportFailure;
  readonly bytes: number;
}

function FailedCard({ song, failure, bytes }: FailedCardProps) {
  const styles = useStyles();
  const startExport = useStemPlayer((s) => s.startExport);
  const dismissExport = useStemPlayer((s) => s.dismissExport);
  const sameSong = useOtherSong(song) === null;
  const retry = useCallback(() => {
    void startExport();
  }, [startExport]);
  return (
    <Card
      emphasis="danger"
      statusIcon={failure === 'noSpace' ? 'storage' : 'error'}
      statusLabel="Failed"
    >
      <View style={styles.stack}>
        <CardText copy={exportFailureCopy(failure, bytes)} />
        <View style={styles.actions}>
          {sameSong ? (
            <Button
              variant="ghost"
              size="prompt"
              label="Retry"
              accessibilityLabel="Retry the export"
              onPress={retry}
            />
          ) : null}
          <Button
            variant="ghost"
            size="prompt"
            label="Dismiss"
            onPress={dismissExport}
          />
        </View>
      </View>
    </Card>
  );
}

export function ExportNotice() {
  const exportState = useStemPlayer((s) => s.exportState);
  switch (exportState.kind) {
    case 'running':
      return <RunningCard song={exportState.song} />;
    case 'ready':
      return (
        <ReadyCard fileName={exportState.fileName} bytes={exportState.bytes} />
      );
    case 'unshared':
      return <UnsharedCard noTarget={exportState.noTarget} />;
    case 'failed':
      return (
        <FailedCard
          song={exportState.song}
          failure={exportState.failure}
          bytes={exportState.bytes}
        />
      );
    case 'idle':
    case 'cancelled':
      return null;
  }
}

export function ExportCancelledSnackbar() {
  const cancelled = useStemPlayer((s) => s.exportState.kind === 'cancelled');
  const dismissExport = useStemPlayer((s) => s.dismissExport);
  if (!cancelled) return null;
  return (
    <Snackbar
      message={EXPORT_CANCELLED}
      bottom={snackbar.aboveDock}
      onTimeout={dismissExport}
    />
  );
}
