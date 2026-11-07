import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';

const input = vi.hoisted(() => ({
  props: {},
}));

vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  TextInput: (props: Readonly<Record<string, unknown>>): ReactNode => {
    input.props = props;
    return null;
  },
}));

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));

const { EditTextInput } = await import('./EditRow.tsx');

const noop = () => undefined;

describe('EditTextInput', () => {
  it('wraps rather than scrolls, and return still leaves the field', () => {
    renderToStaticMarkup(
      <ThemeProvider mode="dark">
        <EditTextInput
          value="A long name"
          onChangeText={noop}
          placeholder="Song name"
          accessibilityLabel="Name"
        />
      </ThemeProvider>,
    );
    expect(input.props.multiline).toBe(true);
    expect(input.props.submitBehavior).toBe('blurAndSubmit');
  });
});
