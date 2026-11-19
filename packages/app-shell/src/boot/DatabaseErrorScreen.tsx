import type { DatabaseOpenError } from '@kitbag/core-db';
import {
  createThemedStyles,
  databaseError,
  Icon,
  libraryList,
  lineRatio,
  LinearProgress,
  Snackbar,
  snackbar,
  textRoles,
  textStyle,
  useTextScaled,
} from '@kitbag/core-design';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatabaseErrorActions } from './DatabaseErrorActions.tsx';
import {
  DATABASE_ERROR_COPY,
  DATABASE_ERROR_TEXT,
  databaseErrorFrame,
  offersRetry,
  type DatabaseErrorCopy,
} from './databaseErrorCopy.ts';
import { useDatabaseRetry } from './useDatabaseRetry.ts';
import { useNotice } from './useNotice.ts';
import { useSaveCopy } from './useSaveCopy.ts';

const useStyles = createThemedStyles((theme) => ({
  frame: { flex: 1, backgroundColor: theme.color.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: libraryList.emptyH,
  },
  content: {
    alignItems: 'center',
    gap: libraryList.emptyGap,
    paddingVertical: databaseError.screenV,
  },
  mark: {
    width: libraryList.emptyMark,
    height: libraryList.emptyMark,
    borderRadius: libraryList.emptyMarkRadius,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...textStyle(textRoles.listEmptyTitle),
    color: theme.color.text,
    textAlign: 'center',
  },
  reason: {
    ...textStyle(textRoles.listEmptyReason),
    lineHeight: textRoles.listEmptyReason.size * lineRatio.compactBody,
    color: theme.color.text2,
    textAlign: 'center',
  },
  progress: { alignSelf: 'stretch', marginTop: databaseError.actionsTop },
  hint: {
    ...textStyle(textRoles.sheetHint),
    lineHeight: textRoles.sheetHint.size * lineRatio.hint,
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

function DatabaseErrorMessage({ copy }: { readonly copy: DatabaseErrorCopy }) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.mark}>
        <Icon name={copy.icon} size="emptyMark" color="text2" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.reason}>{copy.reason}</Text>
    </>
  );
}

function RetryProgress() {
  const styles = useStyles();
  return (
    <View style={styles.progress}>
      <LinearProgress
        percent={null}
        accessibilityLabel={DATABASE_ERROR_TEXT.opening}
      />
    </View>
  );
}

function DatabaseErrorNotice({
  notice,
  onTimeout,
}: {
  readonly notice: string | null;
  readonly onTimeout: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (notice === null) return null;
  return (
    <Snackbar
      message={notice}
      bottom={insets.bottom + snackbar.aboveNav}
      onTimeout={onTimeout}
    />
  );
}

export interface DatabaseErrorScreenProps {
  readonly error: DatabaseOpenError;
}

export function DatabaseErrorScreen({ error }: DatabaseErrorScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const stacked = useTextScaled();
  const { notice, setNotice, clearNotice } = useNotice();
  const retry = useDatabaseRetry(error, setNotice);
  const copy = useSaveCopy(setNotice);
  const frame = databaseErrorFrame(retry.error);
  return (
    <View
      style={[
        styles.frame,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <DatabaseErrorMessage copy={DATABASE_ERROR_COPY[frame]} />
          {retry.retrying ? <RetryProgress /> : null}
          <DatabaseErrorActions
            stacked={stacked}
            canRetry={offersRetry(frame)}
            retrying={retry.retrying}
            saving={copy.saving}
            onRetry={retry.retry}
            onSaveCopy={copy.saveCopy}
          />
          <Text style={styles.hint}>{DATABASE_ERROR_TEXT.saveHint}</Text>
        </View>
      </ScrollView>
      <DatabaseErrorNotice notice={notice} onTimeout={clearNotice} />
    </View>
  );
}
