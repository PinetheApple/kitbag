// react-test-renderer is deprecated, but it alone renders with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createContext, useContext, useEffect } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it } from 'vitest';

import { BridgedProvider, useSheetBridge } from './SheetBridge.tsx';
import { SheetHost, useSheetPortal } from './SheetHost.tsx';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const Source = createContext('none');

function Reader() {
  return <output>{useContext(Source)}</output>;
}

function OpenSheet() {
  const { show } = useSheetPortal();
  const bridge = useSheetBridge();
  useEffect(() => {
    show('sheet', bridge(<Reader />), 'open');
  });
  return null;
}

function screen(value: string) {
  return (
    <SheetHost topInset={0}>
      <BridgedProvider context={Source} value={value}>
        <OpenSheet />
      </BridgedProvider>
    </SheetHost>
  );
}

const shown = (tree: ReactTestRenderer) =>
  tree.root.findAllByType('output' as never).map((node) => node.children[0]);

it('gives a sheet drawn at the host the provider of the screen that opened it', () => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(screen('view'));
  });
  if (tree === undefined) throw new Error('not mounted');
  expect(shown(tree)).toEqual(['view']);
  act(() => {
    tree?.update(screen('live'));
  });
  expect(shown(tree)).toEqual(['live']);
});
