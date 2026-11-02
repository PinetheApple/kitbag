import type {
  Category,
  Conflict,
  ImportMode,
  Resolution,
} from '@kitbag/core-db';
import {
  Button,
  Card,
  createThemedStyles,
  EditCheckRow,
  EditGroup,
  EditValue,
  Icon,
  RowIcon,
  RowText,
  SegmentedControl,
  space,
  textRoles,
  textStyle,
  type SegmentOption,
} from '@kitbag/core-design';
import {
  commitStep,
  planConflicts,
  useRestore,
  type RestoreReview,
} from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  applyLabel,
  CATEGORY_LABELS,
  categoryValue,
  conflictBanner,
  DONE_LABEL,
  failureText,
  modeHint,
  PICK_AGAIN,
  replaceConfirmBody,
  RESTORE_ORDER,
  RESTORE_TITLE,
  restoredText,
  REVIEW_LABEL,
  sourceDetail,
  STALE_NOTICE,
} from './backupText.ts';
import { ConflictSheet, ReplaceSheet } from './RestoreSheets.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';

const MODE_OPTIONS: readonly SegmentOption<ImportMode>[] = [
  { value: 'merge', label: 'Merge' },
  { value: 'replace', label: 'Replace' },
];

type OpenSheet = 'none' | 'conflicts' | 'replace';

const useStyles = createThemedStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
  spacer: { flexGrow: 1 },
  hint: { ...textStyle(textRoles.fieldLabel), color: theme.color.text3 },
  banner: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
  },
  bannerText: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text,
    flexShrink: 1,
  },
  strong: textStyle(textRoles.bannerEmphasis),
}));

function SourceCard({ review }: { readonly review: RestoreReview }) {
  const styles = useStyles();
  const { source, plan } = review;
  const detail = sourceDetail(
    plan.file.version,
    plan.file.exportedAt,
    source.bytes,
  );
  return (
    <Card>
      <View style={styles.row}>
        <RowIcon icon="backupFile" />
        <RowText title={source.name} subtitle={detail} />
      </View>
    </Card>
  );
}

function CategoryRow({
  category,
  review,
  onToggle,
}: {
  readonly category: Category;
  readonly review: RestoreReview;
  readonly onToggle: (category: Category) => void;
}) {
  const { plan } = review;
  const checked = plan.categories.includes(category);
  const value = categoryValue(
    category,
    plan.file.records[category].length,
    checked ? plan.counts[category] : undefined,
  );
  const toggle = useCallback(() => {
    onToggle(category);
  }, [onToggle, category]);
  const label = CATEGORY_LABELS[category];
  return (
    <EditCheckRow
      label={label}
      checked={checked}
      onToggle={toggle}
      accessibilityLabel={`${label}, ${value}`}
    >
      <EditValue muted>{value}</EditValue>
    </EditCheckRow>
  );
}

function ConflictBanner({
  review,
  onReview,
}: {
  readonly review: RestoreReview;
  readonly onReview: () => void;
}) {
  const styles = useStyles();
  const conflicts = planConflicts(review.plan);
  if (conflicts.length === 0) return null;
  const text = conflictBanner(conflicts);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text} ${REVIEW_LABEL}`}
      onPress={onReview}
    >
      <Card emphasis="active" activeLabel={`${text} ${REVIEW_LABEL}`}>
        <View style={styles.bannerRow}>
          <Icon name="warning" size="control" color="text" />
          <Text style={styles.bannerText}>
            {`${text} `}
            <Text style={styles.strong}>{REVIEW_LABEL}</Text>
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function useReviewEdits() {
  const setMode = useRestore((s) => s.setMode);
  const toggleCategory = useRestore((s) => s.toggleCategory);
  const resolve = useRestore((s) => s.resolve);
  const chooseMode = useCallback(
    (mode: ImportMode) => {
      void setMode(mode);
    },
    [setMode],
  );
  const toggle = useCallback(
    (category: Category) => {
      void toggleCategory(category);
    },
    [toggleCategory],
  );
  const choose = useCallback(
    (conflict: Conflict, resolution: Resolution) => {
      void resolve(conflict, resolution);
    },
    [resolve],
  );
  return { chooseMode, toggle, choose };
}

function useReviewSheets(review: RestoreReview) {
  const apply = useRestore((s) => s.apply);
  const [sheet, setSheet] = useState<OpenSheet>('none');
  const step = commitStep(review);
  const close = useCallback(() => {
    setSheet('none');
  }, []);
  const openConflicts = useCallback(() => {
    setSheet('conflicts');
  }, []);
  const commit = useCallback(() => {
    if (step === 'review') setSheet('conflicts');
    else if (step === 'confirmReplace') setSheet('replace');
    else if (step === 'apply') void apply();
  }, [step, apply]);
  const confirmReplace = useCallback(
    (typed: string) => {
      setSheet('none');
      void apply(typed);
    },
    [apply],
  );
  return {
    sheet,
    waiting: step === 'wait',
    close,
    openConflicts,
    commit,
    confirmReplace,
  };
}

function Review({ review }: { readonly review: RestoreReview }) {
  const styles = useStyles();
  const edits = useReviewEdits();
  const sheets = useReviewSheets(review);
  const { plan } = review;
  const categories = RESTORE_ORDER.filter((category) =>
    plan.file.categories.includes(category),
  );
  return (
    <>
      <SourceCard review={review} />
      <SegmentedControl
        accessibilityLabel="Restore mode"
        options={MODE_OPTIONS}
        selected={plan.mode}
        onSelect={edits.chooseMode}
      />
      <Text style={styles.hint}>{modeHint(plan)}</Text>
      <EditGroup>
        {categories.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            review={review}
            onToggle={edits.toggle}
          />
        ))}
      </EditGroup>
      <ConflictBanner review={review} onReview={sheets.openConflicts} />
      {review.stale ? (
        <Card emphasis="warning" statusIcon="warning" statusLabel="Warning">
          <Text style={styles.banner}>{STALE_NOTICE}</Text>
        </Card>
      ) : null}
      <View style={styles.spacer} />
      <Button
        label={applyLabel(plan)}
        variant={plan.mode === 'replace' ? 'destructive' : 'primary'}
        disabled={sheets.waiting}
        onPress={sheets.commit}
      />
      <ConflictSheet
        visible={sheets.sheet === 'conflicts'}
        conflicts={planConflicts(plan)}
        resolutions={review.resolutions}
        onResolve={edits.choose}
        onDismiss={sheets.close}
      />
      <ReplaceSheet
        visible={sheets.sheet === 'replace'}
        body={replaceConfirmBody(plan)}
        confirmLabel={applyLabel(plan)}
        onConfirm={sheets.confirmReplace}
        onDismiss={sheets.close}
      />
    </>
  );
}

function Outcome({
  text,
  failed,
  actionLabel,
  onAction,
}: {
  readonly text: string;
  readonly failed: boolean;
  readonly actionLabel: string;
  readonly onAction: () => void;
}) {
  const styles = useStyles();
  const body = <Text style={styles.banner}>{text}</Text>;
  return (
    <>
      {failed ? (
        <Card emphasis="danger" statusIcon="error" statusLabel="Failed">
          {body}
        </Card>
      ) : (
        <Card emphasis="success" statusIcon="success" statusLabel={DONE_LABEL}>
          {body}
        </Card>
      )}
      <Button
        label={actionLabel}
        variant={failed ? 'tonal' : 'primary'}
        onPress={onAction}
      />
    </>
  );
}

function RestoreBody({ onBack }: { readonly onBack: () => void }) {
  const restore = useRestore((s) => s.restore);
  const pick = useRestore((s) => s.pick);
  const pickAgain = useCallback(() => {
    void pick();
  }, [pick]);
  switch (restore.phase) {
    case 'review':
    case 'applying':
      return <Review review={restore} />;
    case 'done':
      return (
        <Outcome
          text={restoredText(restore.mode, restore.counts)}
          failed={false}
          actionLabel={DONE_LABEL}
          onAction={onBack}
        />
      );
    case 'failed':
      return (
        <Outcome
          text={failureText(restore.failure)}
          failed
          actionLabel={PICK_AGAIN}
          onAction={pickAgain}
        />
      );
    case 'empty':
      return <Button label={PICK_AGAIN} onPress={pickAgain} />;
    case 'reading':
      return null;
  }
}

export function RestoreScreen({ onBack }: { readonly onBack: () => void }) {
  const reset = useRestore((s) => s.reset);
  useEffect(() => reset, [reset]);
  return (
    <SettingsFrame title={RESTORE_TITLE} onBack={onBack} fillScreen>
      <RestoreBody onBack={onBack} />
    </SettingsFrame>
  );
}
