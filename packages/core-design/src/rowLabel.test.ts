import { describe, expect, it } from 'vitest';

import { rowLabel } from './rowLabel.ts';

describe('rowLabel', () => {
  it('reads the title alone when there is no subtitle', () => {
    expect(rowLabel('Tools')).toBe('Tools');
  });

  it('reads the title, then the subtitle', () => {
    expect(rowLabel('Tools', '4 on')).toBe('Tools, 4 on');
  });
});
