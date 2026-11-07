import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';

const input = vi.hoisted((): { props: Readonly<Record<string, unknown>> } => ({
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

function renderInput(onChangeText: (value: string) => void = noop) {
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <EditTextInput
        value="A long name"
        onChangeText={onChangeText}
        placeholder="Song name"
        accessibilityLabel="Name"
      />
    </ThemeProvider>,
  );
  return input.props.onChangeText as (value: string) => void;
}

describe('EditTextInput', () => {
  it.each([
    ['A\nB', 'A B'],
    ['A\r\nB', 'A B'],
    ['A  \n\n  B\n', 'A B '],
    ['A  B', 'A  B'],
  ])('turns the line breaks in %j into one space', (typed, stored) => {
    const onChangeText = vi.fn();
    renderInput(onChangeText)(typed);
    expect(onChangeText).toHaveBeenCalledWith(stored);
  });

  it('wraps rather than scrolls, and return still leaves the field', () => {
    renderInput();
    expect(input.props.multiline).toBe(true);
    expect(input.props.submitBehavior).toBe('blurAndSubmit');
  });
});
