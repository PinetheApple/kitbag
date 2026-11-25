import { layout } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { StyleSheet } from '../testing/reactNativeHosts.ts';
import {
  DIALOG_TITLE,
  hostAncestors,
  PAD,
  RESET,
  retiming,
} from './playerHarness.test-helper.tsx';
import { StemPlayerScreen } from './StemPlayerScreen.tsx';

async function askedToReset() {
  const p = await retiming();
  await p.touchDown(PAD);
  await p.press(RESET);
  return p;
}

describe('retime confirm dialog', () => {
  it('dims from above the screen, so a capped content column cannot clip its scrim', async () => {
    const p = await askedToReset();
    const title = p.byText(DIALOG_TITLE);
    const screen = p.renderer.root.findByType(StemPlayerScreen);
    expect(screen.findAll((node) => node === title)).toHaveLength(0);
  });

  it('keeps the dialog card inside the content column', async () => {
    const p = await askedToReset();
    const capped = hostAncestors(p.byText(DIALOG_TITLE)).filter(
      (node) =>
        StyleSheet.flatten(node.props.style).maxWidth ===
        layout.maxContentWidth,
    );
    expect(capped).toHaveLength(1);
  });

  it('closes when another screen covers the player and stays closed on return', async () => {
    const p = await askedToReset();
    p.setFocused(false);
    expect(p.has(DIALOG_TITLE)).toBe(false);
    p.setFocused(true);
    expect(p.has(DIALOG_TITLE)).toBe(false);
  });
});
