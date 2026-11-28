import type { ManualTempo } from '@kitbag/core-db';

export interface TempoPreview {
  readonly savedGrid: boolean;
}

interface PreviewSessionContext {
  readonly ready: () => boolean;
  readonly click: () => boolean;
  readonly toggleClick: () => Promise<void>;
  readonly show: (draft: ManualTempo) => void;
  readonly restore: () => void;
}

export function previewSession({
  ready,
  click,
  toggleClick,
  show,
  restore,
}: PreviewSessionContext) {
  let draft: ManualTempo | null = null;
  let clickBefore: boolean | null = null;
  const end = () => {
    if (clickBefore === null) return;
    const clickWasOff = !clickBefore;
    clickBefore = null;
    draft = null;
    restore();
    if (clickWasOff && click()) void toggleClick();
  };
  const begin = (tempo: ManualTempo) => {
    const clickNow = click();
    const opening = clickBefore === null;
    clickBefore ??= clickNow;
    draft = tempo;
    show(tempo);
    if (opening && !clickNow) void toggleClick();
  };
  return {
    draft: () => draft,
    reset: () => {
      clickBefore = null;
      draft = null;
    },
    previewTempo: (tempo: ManualTempo | null) => {
      if (!ready()) return;
      if (tempo === null) end();
      else begin(tempo);
    },
  };
}
