import {
  bodyLineHeight,
  Button,
  createThemedStyles,
  LinearProgress,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import type { ToolJob } from '@kitbag/core-state';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { TURN_ON_DOWNLOADS } from './toolDownloadsText.ts';
import { PAGE_DOCK, type PageDock } from './toolPageModel.ts';
import { formatBytesOf } from './bytes.ts';
import { CANCEL } from './dataFolderText.ts';
import {
  CHECKING,
  DONE,
  DOWNLOADING,
  INSTALLING,
  installLabel,
  OPEN_NOW,
  progressPercent,
  REMOVE,
  THEN_INSTALLING,
  TRY_AGAIN,
} from './toolPageText.ts';
import { useToolScreenStyles } from './toolScreenStyles.ts';

const useStyles = createThemedStyles((theme) => {
  const line = {
    ...textStyle(textRoles.editValue),
    lineHeight: textRoles.editValue.size * bodyLineHeight,
  };
  return {
    progline: { flexDirection: 'row', justifyContent: 'space-between' },
    stage: { ...line, color: theme.color.text },
    detail: { ...line, color: theme.color.text2 },
  };
});

export interface ToolInstallBarProps {
  readonly dock: PageDock;
  readonly sizeBytes: number;
  readonly job: ToolJob | undefined;
  readonly onInstall: () => void;
  readonly onOptIn: () => void;
  readonly onCancel: () => void;
  readonly onDismiss: () => void;
  readonly onRemove: () => void;
  readonly onOpen?: (() => void) | undefined;
}

function Progress({
  stage,
  detail,
  percent,
  onCancel,
}: {
  readonly stage: string;
  readonly detail: string;
  readonly percent: number | null;
  readonly onCancel: () => void;
}) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.progline}>
        <Text style={styles.stage}>{stage}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <LinearProgress percent={percent} accessibilityLabel={stage} />
      <Button size="sheet" variant="ghost" label={CANCEL} onPress={onCancel} />
    </>
  );
}

function DockContent(props: ToolInstallBarProps): ReactNode {
  const { job, onCancel } = props;
  switch (props.dock) {
    case PAGE_DOCK.install:
      return (
        <Button
          size="sheet"
          variant="primary"
          icon="saveInto"
          label={installLabel(props.sizeBytes)}
          onPress={props.onInstall}
        />
      );
    case PAGE_DOCK.optIn:
      return (
        <Button
          size="sheet"
          variant="primary"
          label={TURN_ON_DOWNLOADS}
          onPress={props.onOptIn}
        />
      );
    case PAGE_DOCK.downloading:
      return (
        <Progress
          stage={DOWNLOADING}
          detail={
            job === undefined
              ? ''
              : formatBytesOf(job.receivedBytes, job.totalBytes)
          }
          percent={job === undefined ? null : progressPercent(job)}
          onCancel={onCancel}
        />
      );
    case PAGE_DOCK.checking:
      return (
        <Progress
          stage={CHECKING}
          detail={THEN_INSTALLING}
          percent={null}
          onCancel={onCancel}
        />
      );
    case PAGE_DOCK.installing:
      return (
        <Progress
          stage={INSTALLING}
          detail=""
          percent={null}
          onCancel={onCancel}
        />
      );
    case PAGE_DOCK.done:
      return (
        <>
          {props.onOpen === undefined ? null : (
            <Button
              size="sheet"
              variant="primary"
              label={OPEN_NOW}
              onPress={props.onOpen}
            />
          )}
          <Button size="sheet" label={DONE} onPress={props.onDismiss} />
        </>
      );
    case PAGE_DOCK.retry:
      return (
        <>
          <Button
            size="sheet"
            variant="primary"
            icon="analyzing"
            label={TRY_AGAIN}
            onPress={props.onInstall}
          />
          <Button
            size="sheet"
            variant="ghost"
            label={CANCEL}
            onPress={props.onDismiss}
          />
        </>
      );
    case PAGE_DOCK.remove:
      return (
        <Button
          size="sheet"
          icon="delete"
          label={REMOVE}
          onPress={props.onRemove}
        />
      );
  }
}

export function ToolInstallBar(props: ToolInstallBarProps) {
  const styles = useToolScreenStyles();
  return (
    <View style={styles.dock}>
      <DockContent {...props} />
    </View>
  );
}
