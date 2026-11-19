import { useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';

import {
  CLICK_SECTION,
  clickCopy,
  clickUnavailable,
  type ClickSection,
  groupingLabel,
  rateLabel,
} from '../logic/clickView.ts';
import { ValueRow } from './ValueRow.tsx';

export function ClickRows({
  onOpen,
}: {
  readonly onOpen: (section: ClickSection) => void;
}) {
  const reason = useStemPlayer(clickUnavailable);
  const openGrouping = useCallback(() => {
    onOpen(CLICK_SECTION.grouping);
  }, [onOpen]);
  const openRate = useCallback(() => {
    onOpen(CLICK_SECTION.rate);
  }, [onOpen]);
  const grouping = useStemPlayer((s) => groupingLabel(s.clickGrouping));
  const rate = useStemPlayer((s) => rateLabel(s.clickRate));
  return (
    <>
      <ValueRow
        icon="clickGrouping"
        title={clickCopy.groupingRow}
        value={grouping}
        reason={reason}
        onPress={openGrouping}
      />
      <ValueRow
        icon="clickRate"
        title={clickCopy.rateRow}
        value={rate}
        reason={reason}
        onPress={openRate}
      />
    </>
  );
}
