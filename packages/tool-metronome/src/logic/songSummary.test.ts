import { describe, expect, it } from 'vitest';

import { setlistTitle } from './songSummary.ts';
import { TEXT_PLACEHOLDER } from './textPlaceholder.ts';

describe('setlistTitle', () => {
  it('shows the setlist name once it has loaded', () => {
    expect(setlistTitle('Wedding set')).toBe('Wedding set');
  });

  it('renders the placeholder while the setlist is loading', () => {
    expect(setlistTitle(undefined)).toBe(TEXT_PLACEHOLDER);
  });
});
