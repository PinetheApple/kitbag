import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown>;

const seen = vi.hoisted(() => ({
  sheet: null as Props | null,
  picker: { role: 'accent', setRole: vi.fn(), pick: vi.fn() },
  visible: [] as boolean[],
  onChanges: [] as unknown[],
  previews: [] as unknown[],
}));
const metronome = vi.hoisted(() => ({
  previewSound: vi.fn(),
  previewSelectedSlot: vi.fn(),
}));
const store = vi.hoisted(() => ({
  pattern: { sounds: { normal: 1, accent: 4 } },
  setSounds: vi.fn(),
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  SoundPickerSheet: (props: Props) => {
    seen.sheet = props;
    return null;
  },
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getPlayAlongStore: () => ({ getState: () => store }),
  useMetronome: <T,>(select: (state: typeof metronome) => T) =>
    select(metronome),
  useSoundPicker: (visible: boolean, onChange: unknown, preview: unknown) => {
    seen.visible.push(visible);
    seen.onChanges.push(onChange);
    seen.previews.push(preview);
    return seen.picker;
  },
}));
vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(select: (state: typeof store) => T) => select(store),
}));

const { SOUND_OPTIONS, SOUND_PICKER_HINT } = await import('@kitbag/core-state');
const { ClickSoundSheet, changePlayAlongSounds } =
  await import('./ClickSoundSheet.tsx');

function render(visible = true) {
  renderToStaticMarkup(
    createElement(ClickSoundSheet, {
      visible,
      bottomInset: 0,
      onDismiss: vi.fn(),
    }),
  );
  return seen.sheet ?? {};
}

beforeEach(() => {
  seen.visible.length = 0;
  seen.onChanges.length = 0;
  seen.previews.length = 0;
  vi.clearAllMocks();
});

describe('the Play along click sound sheet', () => {
  it("shows the play along slot's sound for the role being picked", () => {
    expect(render().selected).toBe('4');
  });

  it('offers the built-in sounds with the plain picker hint', () => {
    const sheet = render();
    expect(sheet.options).toBe(SOUND_OPTIONS);
    expect(sheet.hint).toBe(SOUND_PICKER_HINT);
    expect(sheet.children).toBeUndefined();
  });

  it('picks through the shared sound picker, held only while open', () => {
    const sheet = render(false);
    expect(seen.visible).toEqual([false]);
    expect(sheet.onPick).toBe(seen.picker.pick);
    expect(sheet.onRole).toBe(seen.picker.setRole);
    expect(seen.onChanges).toEqual([changePlayAlongSounds]);
  });

  it('writes a picked sound to the play along store, keeping the other role', () => {
    changePlayAlongSounds((sounds) => ({ ...sounds, accent: 2 }));
    expect(store.setSounds).toHaveBeenCalledExactlyOnceWith(1, 2);
  });

  it('previews on the selected slot, which sounds while the standalone has yielded', () => {
    render();
    expect(seen.previews).toEqual([metronome.previewSelectedSlot]);
  });
});
