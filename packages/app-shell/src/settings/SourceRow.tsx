import { EditRow, EditValue, useTextScaled } from '@kitbag/core-design';
import { useCallback } from 'react';

import { SOURCE_LABEL, SOURCE_URL } from './about.ts';
import { openUrl } from './openUrl.ts';

const SOURCE_ROW_LABEL = 'Source & issues';

export function SourceRow() {
  const oneLine = !useTextScaled();
  const openSource = useCallback(() => {
    openUrl(SOURCE_URL);
  }, []);
  return (
    <EditRow
      label={SOURCE_ROW_LABEL}
      accessibilityRole="link"
      accessibilityLabel={`${SOURCE_ROW_LABEL}, ${SOURCE_URL}`}
      onPress={openSource}
      singleLine={oneLine}
    >
      <EditValue muted oneLine={oneLine} ellipsizeMode="middle">
        {SOURCE_LABEL}
      </EditValue>
    </EditRow>
  );
}
