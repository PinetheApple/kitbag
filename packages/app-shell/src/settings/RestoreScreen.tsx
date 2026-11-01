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
  canApply,
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

const BOLD_BODY = 600;

const useStyles = createThemedStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.rowGap },
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
  strong: textStyle({ ...textRoles.fieldLabel, weight: BOLD_BODY }),
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

function useReviewActions() {
  const setMode = useRestore((s) => s.setMode);
  const toggleCategory = useRestore((s) => s.toggleCategory);
  const resolve = useRestore((s) => s.resolve);
  const apply = useRestore((s) => s.apply);
  const [sheet, setSheet] = useState<OpenSheet>('none');
  const closeSheet = useCallback(() => {
    setSheet('none');
  }, []);
  const openConflicts = useCallback(() => {
    setSheet('conflicts');
  }, []);
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
  const confirmReplace = useCallback(
    (typed: string) => {
      setSheet('none');
      void apply(typed);
    },
    [apply],
  );
  const choose = useCallback(
    (conflict: Conflict, resolution: Resolution) => {
      void resolve(conflict, resolution);
    },
    [resolve],
  );
  return {
    ...{ sheet, setSheet, closeSheet, openConflicts, chooseMode, toggle },
    ...{ choose, apply, confirmReplace },
  };
}

function Review({ review }: { readonly review: RestoreReview }) {
  const styles = useStyles();
  const actions = useReviewActions();
  const { plan } = review;
  const replacing = plan.mode === 'replace';
  const { apply, setSheet } = actions;
  const commit = useCallback(() => {
    if (replacing) setSheet('replace');
    else void apply();
  }, [replacing, apply, setSheet]);
  const categories = RESTORE_ORDER.filter((category) =>
    plan.file.categories.includes(category),
  );
  return (
    <>
      <SourceCard review={review} />
      <SegmentedControl
        fill
        accessibilityLabel="Restore mode"
        options={MODE_OPTIONS}
        selected={plan.mode}
        onSelect={actions.chooseMode}
      />
      <Text style={styles.hint}>{modeHint(plan)}</Text>
      <EditGroup>
        {categories.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            review={review}
            onToggle={actions.toggle}
          />
        ))}
      </EditGroup>
      <ConflictBanner review={review} onReview={actions.openConflicts} />
      {review.stale ? (
        <Card emphasis="warning" statusIcon="warning" statusLabel="Warning">
          <Text style={styles.banner}>{STALE_NOTICE}</Text>
        </Card>
      ) : null}
      <Button
        label={applyLabel(plan)}
        variant={replacing ? 'destructive' : 'primary'}
        fill
        disabled={!canApply(review)}
        onPress={commit}
      />
      <ConflictSheet
        visible={actions.sheet === 'conflicts'}
        conflicts={planConflicts(plan)}
        resolutions={review.resolutions}
        onResolve={actions.choose}
        onDismiss={actions.closeSheet}
      />
      <ReplaceSheet
        visible={actions.sheet === 'replace'}
        body={replaceConfirmBody(plan)}
        confirmLabel={applyLabel(plan)}
        onConfirm={actions.confirmReplace}
        onDismiss={actions.closeSheet}
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
        <Card emphasis="success" statusIcon="success" statusLabel="Done">
          {body}
        </Card>
      )}
      <Button
        label={actionLabel}
        variant={failed ? 'tonal' : 'primary'}
        fill
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
      return <Button label={PICK_AGAIN} fill onPress={pickAgain} />;
    case 'reading':
      return null;
  }
}

export function RestoreScreen({ onBack }: { readonly onBack: () => void }) {
  const reset = useRestore((s) => s.reset);
  useEffect(() => reset, [reset]);
  return (
    <SettingsFrame title={RESTORE_TITLE} onBack={onBack}>
      <RestoreBody onBack={onBack} />
    </SettingsFrame>
  );
}
