import { Sheet, SheetHint } from '@kitbag/core-design';
import {
  dataFolderStore,
  folderUnavailable,
  useDataFolder,
  useSongLibrary,
  useStemDeck,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceButtons, type Choice } from '../settings/ChoiceButtons.tsx';
import { moveErrorText, type Places } from '../settings/dataFolderMoveText.ts';
import {
  CARD_PLACE,
  findVolume,
  placeName,
  THE_CARD,
  volumeName,
} from '../settings/dataFolderText.ts';
import {
  cardMissingHints,
  CLOSE_CARD_MISSING,
  internalOffer,
  PUT_BACK,
  USE_INTERNAL,
} from './cardMissing.ts';
import { cardMissingTitle } from './libraryStrip.ts';

const NO_PLACES: Places = { source: null, target: null };

function useImporting(): boolean {
  const songs = useSongLibrary((s) => s.importing.length > 0);
  const stemDeck = useStemDeck((s) => s.importView?.running === true);
  return songs || stemDeck;
}

interface MissingPlace {
  readonly title: string;
  readonly name: string;
}

function useMissingPlace(rootMissing: boolean): MissingPlace {
  const volumes = useDataFolder((s) => s.volumes);
  if (!rootMissing || volumes === null)
    return { title: CARD_PLACE, name: THE_CARD };
  const uuid = volumes.currentVolumeUuid;
  return {
    title: placeName(uuid),
    name: volumeName(findVolume(volumes, uuid), uuid),
  };
}

function useRefusal() {
  const [refusal, setRefusal] = useState<string | null>(null);
  const explain = useCallback(() => {
    const { error, codes, volumes } = dataFolderStore.getState();
    if (error === null || codes === null) return;
    const source = volumes?.currentVolumeUuid ?? null;
    setRefusal(moveErrorText(error, codes, { source, target: null }).body);
  }, []);
  const clear = useCallback(() => {
    setRefusal(null);
  }, []);
  return { refusal, explain, clear };
}

export interface CardMissingSheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
}

export function CardMissingSheet({
  visible,
  onDismiss,
}: CardMissingSheetProps) {
  const insets = useSafeAreaInsets();
  const rootMissing = useDataFolder(folderUnavailable);
  const moveActive = useDataFolder((s) => s.move !== null);
  const pending = useDataFolder((s) => s.pending);
  const codes = useDataFolder((s) => s.codes);
  const switchToInternal = useDataFolder((s) => s.switchToInternalStorage);
  const refreshVolumes = useDataFolder((s) => s.refreshVolumes);
  const importing = useImporting();
  const place = useMissingPlace(rootMissing);
  const { refusal, explain, clear } = useRefusal();
  const offer = internalOffer({ rootMissing, moveActive, importing });

  const dismiss = useCallback(() => {
    clear();
    onDismiss();
  }, [clear, onDismiss]);
  const putBack = useCallback(() => {
    void refreshVolumes();
    dismiss();
  }, [refreshVolumes, dismiss]);
  const switchInternal = useCallback(() => {
    if (offer !== 'offer' || dataFolderStore.getState().pending) return;
    clear();
    void switchToInternal().then((acted) => {
      if (acted) onDismiss();
      else explain();
    });
  }, [offer, clear, switchToInternal, onDismiss, explain]);

  const offered = offer !== 'none';
  const putBackChoice: Choice = {
    key: PUT_BACK,
    label: PUT_BACK,
    primary: true,
    disabled: false,
    onPress: putBack,
  };
  const choices: readonly Choice[] = offered
    ? [
        {
          key: USE_INTERNAL,
          label: USE_INTERNAL,
          primary: false,
          disabled: offer === 'importing' || pending,
          onPress: switchInternal,
        },
        putBackChoice,
      ]
    : [putBackChoice];
  const importingNote =
    offer === 'importing' && codes !== null
      ? moveErrorText(codes.moveErrors.importLockHeld, codes, NO_PLACES).body
      : null;
  return (
    <Sheet
      visible={visible}
      title={cardMissingTitle(place.title)}
      titleIcon="sdCard"
      dismissLabel={CLOSE_CARD_MISSING}
      bottomInset={insets.bottom}
      onDismiss={dismiss}
    >
      {cardMissingHints(place.name, offered).map((hint) => (
        <SheetHint key={hint}>{hint}</SheetHint>
      ))}
      {importingNote === null ? null : <SheetHint>{importingNote}</SheetHint>}
      {refusal === null ? null : <SheetHint>{refusal}</SheetHint>}
      <ChoiceButtons choices={choices} />
    </Sheet>
  );
}
