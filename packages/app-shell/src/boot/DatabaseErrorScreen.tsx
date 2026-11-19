import type { DatabaseOpenError } from '@kitbag/core-db';
import {
  Button,
  createThemedStyles,
  databaseError,
  databaseErrorText,
  Icon,
  libraryList,
  lineRatio,
  LinearProgress,
  Snackbar,
  space,
  textRoles,
  textStyle,
  useTextScaled,
} from '@kitbag/core-design';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DATABASE_ERROR_COPY,
  DATABASE_ERROR_TEXT,
  databaseErrorFrame,
} from './databaseErrorCopy.ts';
import { reopenDatabase, saveDatabaseCopyNotice } from './databaseGate';

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
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.controlGap,
    marginTop: databaseError.actionsTop,
  },
  stacked: { flexDirection: 'column' },
  hint: {
    ...textStyle(databaseErrorText.hint),
    lineHeight: databaseErrorText.hint.size * databaseError.hintLine,
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

export interface DatabaseErrorScreenProps {
  readonly error: DatabaseOpenError;
}

export function DatabaseErrorScreen({
  error: launchError,
}: DatabaseErrorScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const stacked = useTextScaled();
  const [error, setError] = useState(launchError);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const saving = useRef(false);
  const copy = DATABASE_ERROR_COPY[databaseErrorFrame(error)];

  // The open blocks the JS thread, so it runs after the in-flight frame commits.
  useEffect(() => {
    if (!retrying) return;
    let live = true;
    reopenDatabase()
      .then((failed) => {
        if (!live || failed === undefined) return;
        setError(failed);
        setNotice(DATABASE_ERROR_TEXT.stillFailing);
        setRetrying(false);
      })
      .catch((reloadError: unknown) => {
        console.warn(
          '[kitbag] relaunch after the database opened failed',
          reloadError,
        );
        if (live) setRetrying(false);
      });
    return () => {
      live = false;
    };
  }, [retrying]);

  const handleRetry = useCallback(() => {
    setNotice(null);
    setRetrying(true);
  }, []);

  const handleSaveCopy = useCallback(() => {
    if (saving.current) return;
    saving.current = true;
    setNotice(null);
    void saveDatabaseCopyNotice(new Date()).then((saved) => {
      saving.current = false;
      setNotice(saved);
    });
  }, []);

  const handleNoticeTimeout = useCallback(() => {
    setNotice(null);
  }, []);

  const frameStyle = useMemo(
    () => [
      styles.frame,
      { paddingTop: insets.top, paddingBottom: insets.bottom },
    ],
    [styles.frame, insets.top, insets.bottom],
  );

  return (
    <View style={frameStyle}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.mark}>
            <Icon name={copy.icon} size="emptyMark" color="text2" />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.reason}>{copy.reason}</Text>
          {retrying ? (
            <View style={styles.progress}>
              <LinearProgress
                percent={null}
                accessibilityLabel={DATABASE_ERROR_TEXT.opening}
              />
            </View>
          ) : null}
          <View style={[styles.actions, stacked && styles.stacked]}>
            <Button
              variant="primary"
              size="target"
              icon="analyzing"
              iconSize="emptyButton"
              label={DATABASE_ERROR_TEXT.retry}
              disabled={retrying}
              fill={!stacked}
              onPress={handleRetry}
            />
            <Button
              variant="tonal"
              size="target"
              icon="backupFile"
              iconSize="emptyButton"
              label={DATABASE_ERROR_TEXT.saveCopy}
              disabled={retrying}
              fill={!stacked}
              onPress={handleSaveCopy}
            />
          </View>
          <Text style={styles.hint}>{DATABASE_ERROR_TEXT.saveHint}</Text>
        </View>
      </ScrollView>
      {notice === null ? null : (
        <Snackbar
          message={notice}
          bottom={insets.bottom + databaseError.snackbarAboveNav}
          onTimeout={handleNoticeTimeout}
        />
      )}
    </View>
  );
}
