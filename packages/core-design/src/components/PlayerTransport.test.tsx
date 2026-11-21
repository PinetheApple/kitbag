import { renderToStaticMarkup } from 'react-dom/server';
import type { SharedValue } from 'react-native-reanimated';
import { expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { PlayerTransport } from './PlayerTransport.tsx';
import type { TransportKeyProps } from './TransportKey.tsx';

const keys = vi.hoisted(() => [] as TransportKeyProps[]);

vi.mock('./TransportKey.tsx', () => ({
  TransportKey: (props: TransportKeyProps) => {
    keys.push(props);
    return null;
  },
}));

vi.mock('./PrimaryPlayButton.tsx', () => ({ PlayPauseButton: () => null }));

const LOOP_LABEL = 'Set loop start';

function loopKey() {
  keys.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <PlayerTransport
        playing={{ value: 0 } as SharedValue<number>}
        loopActive={false}
        loopLabel={LOOP_LABEL}
        skipSeconds={10}
        onLoop={vi.fn()}
        onSkip={vi.fn()}
        onTogglePlay={vi.fn()}
      />
    </ThemeProvider>,
  );
  return keys.find((key) => key.accessibilityLabel === LOOP_LABEL);
}

it('draws the loop key as a repeat icon', () => {
  const key = loopKey();
  expect(key?.icon).toBe('repeat');
  expect(key?.text).toBeUndefined();
});
