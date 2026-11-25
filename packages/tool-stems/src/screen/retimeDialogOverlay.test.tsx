import { layout } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { StyleSheet } from '../testing/reactNativeHosts.ts';
import {
  DIALOG_TITLE,
  PAD,
  type Player,
  RESET,
  retiming,
} from './playerHarness.test-helper.tsx';
import { StemPlayerScreen } from './StemPlayerScreen.tsx';

type Node = ReturnType<Player['byText']>;

function ancestors(node: Node): Node[] {
  const chain: Node[] = [];
  for (let step = node.parent; step !== null; step = step.parent)
    chain.push(step);
  return chain;
}

async function resetDialogTitle() {
  const p = await retiming();
  await p.touchDown(PAD);
  await p.press(RESET);
  return { p, title: p.byText(DIALOG_TITLE) };
}

describe('retime confirm dialog', () => {
  it('dims from above the screen, so a capped content column cannot clip its scrim', async () => {
    const { p, title } = await resetDialogTitle();
    const screen = p.renderer.root.findByType(StemPlayerScreen);
    expect(ancestors(title)).not.toContain(screen);
  });

  it('keeps the dialog card inside the content column', async () => {
    const { title } = await resetDialogTitle();
    const capped = ancestors(title).filter(
      (node) =>
        typeof node.type === 'string' &&
        StyleSheet.flatten(node.props.style).maxWidth ===
          layout.maxContentWidth,
    );
    expect(capped).toHaveLength(1);
  });
});
