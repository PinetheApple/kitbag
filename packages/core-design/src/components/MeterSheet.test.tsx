import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { meterCopy, type MeterGridState } from '../meterText.ts';
import { rowLabel } from '../rowLabel.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { MeterRow } from './MeterRow.tsx';
import { MeterSheet } from './MeterSheet.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const pressables = vi.hoisted(() => [] as Props[]);
const live = vi.hoisted(() => ({
  derived: [] as { value: string }[],
  texts: [] as unknown[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    Pressable: (props: Props) => {
      pressables.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('./Sheet.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    Sheet: (props: Props) =>
      props.visible === true
        ? h(
            'section',
            null,
            props.title as string,
            props.titleAction as ReactNode,
            props.notice as ReactNode,
            props.children,
          )
        : null,
    SheetHint: (props: Props) => h('p', null, props.children),
  };
});

vi.mock('react-native-reanimated', () => ({
  useDerivedValue: (worklet: () => string) => {
    const derived = { value: worklet() };
    live.derived.push(derived);
    return derived;
  },
}));

vi.mock('./LiveText.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    LiveText: (props: { readonly text: { readonly value: string } }) => {
      live.texts.push(props.text);
      return h('span', null, props.text.value);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({
  IconGlyph: () => null,
  InlineIcon: () => null,
}));

const { StyleSheet } = await import('react-native');

const METERS = [3, 4];
const DETECTED = { meterBeatsPerBar: null, barOneSeconds: null };
const YOURS = { meterBeatsPerBar: 3, barOneSeconds: 105.3 };
const BAR_ONE_ONLY = { meterBeatsPerBar: null, barOneSeconds: 105.3 };
const OUTSIDE_OPTIONS = 6;
const ROW_LABEL = rowLabel(meterCopy.title, '3/4');
const DETECTED_BAR_ONE = 2.3;
const PLAYHEAD = { value: 64.04 } as never;
const FAILED = 'Needs a beat grid. Re-analyse first.';

const handlers = {
  onPickMeter: vi.fn(),
  onBarOneHere: vi.fn(),
  onReset: vi.fn(),
  onClose: vi.fn(),
};
const onRowPress = vi.fn();

type MeterSheetProps = Parameters<typeof MeterSheet>[0];

function renderSheet(
  override: MeterSheetProps['override'],
  state: MeterGridState = 'ready',
  notice: MeterSheetProps['notice'] = null,
  detectedMeter = 4,
): string {
  pressables.length = 0;
  live.derived.length = 0;
  live.texts.length = 0;
  return renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <MeterSheet
        visible
        options={METERS}
        detectedMeter={detectedMeter}
        detectedBarOneSeconds={DETECTED_BAR_ONE}
        override={override}
        playheadSeconds={PLAYHEAD}
        state={state}
        failedReason={FAILED}
        notice={notice}
        {...handlers}
      />
    </ThemeProvider>,
  );
}

function renderRow(yours: boolean, reason?: string, value = 3): string {
  pressables.length = 0;
  return renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <MeterRow
        value={value}
        yours={yours}
        disabled={reason !== undefined}
        {...(reason === undefined ? {} : { reason })}
        onPress={onRowPress}
      />
    </ThemeProvider>,
  );
}

function pressable(label: string): Props {
  const found = pressables.find((p) => p.accessibilityLabel === label);
  if (found === undefined) throw new Error(`no control labelled ${label}`);
  return found;
}

const press = (label: string) => {
  (pressable(label).onPress as () => void)();
};

const flat = (style: unknown) =>
  StyleSheet.flatten(style as StyleProp<ViewStyle>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MeterSheet', () => {
  it('offers the meters it is given and marks the detected one', () => {
    renderSheet(DETECTED);
    expect(pressable('3/4').accessibilityState).toEqual({ checked: false });
    expect(pressable('4/4').accessibilityState).toEqual({ checked: true });
  });

  it('hands back the picked meter as a number', () => {
    renderSheet(DETECTED);
    press('3/4');
    expect(handlers.onPickMeter).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('always says what was detected', () => {
    expect(renderSheet(DETECTED)).toContain('Detected: 4/4<');
    expect(renderSheet(YOURS)).toContain('Detected: 4/4, bar 1 at 0:02.3');
  });

  it('shows the detected bar 1 and the live playhead until one is set', () => {
    const markup = renderSheet(DETECTED);
    expect(markup).toContain('Bar 1 at 0:02.3');
    expect(markup).toContain('Playhead 1:04.0');
    expect(markup).toContain(meterCopy.playheadExplanation);
    expect(markup).not.toContain(meterCopy.overriddenBadge);
    expect(pressables.map((p) => p.accessibilityLabel)).not.toContain(
      meterCopy.useDetected,
    );
  });

  it('hands the playhead line to LiveText as a derived value, not a string', () => {
    renderSheet(DETECTED);
    expect(live.texts).toHaveLength(1);
    expect(live.texts[0]).toBe(live.derived[0]);
    expect(live.texts[0]).toEqual({ value: 'Playhead 1:04.0' });
  });

  it('keeps the explanation out of the live value, in its own static node', () => {
    const markup = renderSheet(DETECTED);
    expect(markup).toContain(`>${meterCopy.playheadExplanation}</`);
  });

  it('speaks the explanation with the playhead as its referent', () => {
    const markup = renderSheet(DETECTED);
    expect(markup).toContain(
      `aria-label="${meterCopy.playheadExplanationSpoken}"`,
    );
  });

  it('drops the playhead line once bar 1 is set', () => {
    const markup = renderSheet(BAR_ONE_ONLY);
    expect(markup).not.toContain('Playhead');
    expect(live.texts).toHaveLength(0);
    expect(markup).toContain(meterCopy.barOneOverridden);
    expect(markup).toContain('Bar 1 at 1:45.3');
  });

  it('shows a detected meter outside the options as-is and selects none', () => {
    const markup = renderSheet(DETECTED, 'ready', null, OUTSIDE_OPTIONS);
    expect(markup).toContain('Detected: 6/4<');
    for (const meter of METERS) {
      expect(pressable(`${String(meter)}/4`).accessibilityState).toEqual({
        checked: false,
      });
    }
  });

  it('marks an override as yours and offers the detected result back', () => {
    const markup = renderSheet(YOURS);
    expect(markup).toContain(meterCopy.overriddenBadge);
    expect(markup).toContain('Bar 1 at 1:45.3');
    expect(markup).toContain(meterCopy.barOneOverridden);
    expect(pressable('3/4').accessibilityState).toEqual({ checked: true });
    press(meterCopy.useDetected);
    expect(handlers.onReset).toHaveBeenCalledOnce();
  });

  it.each([
    [meterCopy.barOneHere, 'onBarOneHere'],
    [meterCopy.done, 'onClose'],
  ] as const)('routes %s to %s', (label, handler) => {
    renderSheet(YOURS);
    press(label);
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it.each([
    ['pending', meterCopy.pending],
    ['failed', FAILED],
  ] as const)(
    'with the grid %s, says why and offers no controls',
    (state, why) => {
      const markup = renderSheet(YOURS, state);
      expect(markup).toContain(why);
      expect(markup).not.toContain(meterCopy.overriddenBadge);
      expect(pressables.map((p) => p.accessibilityLabel)).toEqual([
        meterCopy.done,
      ]);
    },
  );

  it('draws a notice with its action', () => {
    const onAction = vi.fn();
    const markup = renderSheet(YOURS, 'ready', {
      message: 'Meter set to 3/4. Saved for this song.',
      actionLabel: 'Undo',
      onAction,
      onTimeout: vi.fn(),
    });
    expect(markup).toContain('Meter set to 3/4. Saved for this song.');
    press('Undo');
    expect(onAction).toHaveBeenCalledOnce();
  });
});

describe('MeterRow', () => {
  it('shows the meter, plus yours while an override is set', () => {
    expect(renderRow(false)).toContain('>3/4<');
    expect(renderRow(true)).toContain('>3/4 · yours<');
  });

  it('shows a meter outside the sheet options as-is', () => {
    expect(renderRow(false, undefined, OUTSIDE_OPTIONS)).toContain('>6/4<');
  });

  it('opens the sheet on a tap', () => {
    renderRow(false);
    press(ROW_LABEL);
    expect(onRowPress).toHaveBeenCalledOnce();
  });

  it('with no grid, is disabled and says why', () => {
    const markup = renderRow(true, FAILED);
    expect(markup).toContain(FAILED);
    expect(markup).not.toContain('yours');
    const row = pressable(rowLabel(meterCopy.title, FAILED));
    expect(row.disabled).toBe(true);
    expect(row.accessibilityState).toEqual({ disabled: true });
  });

  it('is at least the minimum touch target tall', () => {
    renderRow(false);
    expect(flat(pressable(ROW_LABEL).style).minHeight).toBeGreaterThanOrEqual(
      minTouchTargetDp,
    );
  });
});
