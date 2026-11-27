import type { ManualTempo, StemSetRecord } from '@kitbag/core-db';

import { previewSession } from '../manualTempo/previewSession.ts';
import type { Get } from './store.ts';
import { effectiveGrid } from './tempoGrid.ts';

interface StemTempoPreviewContext {
  readonly get: Get;
  readonly record: () => StemSetRecord | null;
  readonly showDraft: (
    saved: StemSetRecord,
    draft: ManualTempo,
    savedGrid: boolean,
  ) => void;
  readonly restore: () => void;
}

export function stemTempoPreview({
  get,
  record,
  showDraft,
  restore,
}: StemTempoPreviewContext) {
  const session = previewSession({
    ready: () => get().status === 'ready' && record() !== null,
    click: () => get().click,
    toggleClick: () => get().toggleClick(),
    show: (draft) => {
      const saved = record();
      if (saved === null) return;
      const savedGrid = effectiveGrid(saved, get().tempoMode).beats.length > 0;
      showDraft(saved, draft, savedGrid);
    },
    restore,
  });
  return { reset: session.reset, previewTempo: session.previewTempo };
}
