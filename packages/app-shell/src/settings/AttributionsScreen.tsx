import { EditGroup, EditRow, EditValue } from '@kitbag/core-design';

import { ATTRIBUTIONS } from './attributions.ts';
import { SettingsFrame } from './SettingsFrame.tsx';

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
      </EditGroup>
    </SettingsFrame>
  );
}
