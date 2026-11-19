import { EditValue, SheetHint } from '@kitbag/core-design';
import type { DataFolderVolume, DataFolderVolumes } from '@kitbag/core-native';

import {
  findVolume,
  freeAfterLabel,
  freeAfterText,
  volumeName,
} from './dataFolderText.ts';
import { offerMovesValue, RETURN_OFFER_HINTS } from './returnedCardText.ts';
import { SheetRow } from './StorageSheet.tsx';

export interface ReturnOfferBodyProps {
  readonly volumes: DataFolderVolumes;
  readonly card: DataFolderVolume;
}

export function ReturnOfferBody({ volumes, card }: ReturnOfferBodyProps) {
  const target = volumes.currentVolumeUuid;
  const destination = findVolume(volumes, target);
  const [size, songs] = offerMovesValue(card);
  return (
    <>
      <SheetRow label="Moves">
        <EditValue>
          {`${size} `}
          <EditValue muted>{songs}</EditValue>
        </EditValue>
      </SheetRow>
      <SheetRow label="From">
        <EditValue>{volumeName(card)}</EditValue>
      </SheetRow>
      <SheetRow label="To">
        <EditValue>{volumeName(destination, target)}</EditValue>
      </SheetRow>
      {destination === undefined ? null : (
        <SheetRow label={freeAfterLabel(target)}>
          <EditValue>
            {freeAfterText(destination, { bytes: card.awayBytes })}
          </EditValue>
        </SheetRow>
      )}
      {RETURN_OFFER_HINTS.map((hint) => (
        <SheetHint key={hint}>{hint}</SheetHint>
      ))}
    </>
  );
}
