import { useLibrary, type SongPreset } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import {
  draftFrom,
  editFrom,
  type PresetDraft,
} from '../../logic/presetDraft.ts';

export type DraftUpdate = (update: (draft: PresetDraft) => PresetDraft) => void;

export interface PresetEditor {
  readonly draft: PresetDraft;
  readonly dirty: boolean;
  readonly update: DraftUpdate;
  readonly save: () => Promise<void>;
}

export function usePresetEditor(preset: SongPreset): PresetEditor {
  const savePreset = useLibrary((s) => s.savePreset);
  const [draft, setDraft] = useState(() => draftFrom(preset));
  const [dirty, setDirty] = useState(false);
  const update = useCallback<DraftUpdate>((change) => {
    setDraft(change);
    setDirty(true);
  }, []);
  const save = useCallback(async () => {
    await savePreset(preset.id, editFrom(draft));
    setDirty(false);
  }, [savePreset, preset.id, draft]);
  return { draft, dirty, update, save };
}
