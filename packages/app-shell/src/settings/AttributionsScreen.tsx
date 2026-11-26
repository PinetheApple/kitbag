import { EditGroup, EditRow, EditValue } from '@kitbag/core-design';
import type { SourceCredit } from '@kitbag/core-state';
import { creditLinkText } from '@kitbag/tool-sync';
import { useCallback } from 'react';

import { ATTRIBUTIONS, BPM_CREDITS } from './attributions.ts';
import { openUrl } from './openUrl.ts';
import { SettingsFrame } from './SettingsFrame.tsx';

function CreditRow({ credit }: { readonly credit: SourceCredit }) {
  const link = creditLinkText(credit);
  const open = useCallback(() => {
    openUrl(credit.url);
  }, [credit.url]);
  return (
    <EditRow
      label={credit.name}
      accessibilityRole="link"
      accessibilityLabel={`${credit.name}, BPM data, ${link}`}
      onPress={open}
    >
      <EditValue muted>{link}</EditValue>
    </EditRow>
  );
}

export function AttributionsScreen({
  onBack,
}: {
  readonly onBack: () => void;
}) {
  return (
    <SettingsFrame title="Attributions" onBack={onBack}>
      <EditGroup>
        {ATTRIBUTIONS.map((attribution) => (
          <EditRow key={attribution.name} label={attribution.name}>
            <EditValue muted>{attribution.licence}</EditValue>
          </EditRow>
        ))}
        {BPM_CREDITS.map((credit) => (
          <CreditRow key={credit.name} credit={credit} />
        ))}
      </EditGroup>
    </SettingsFrame>
  );
}
