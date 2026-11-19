import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  KB_MIXDOWN_STATE,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';
import { KITBAG_HOST_OBJECT_KEY } from './host/KitbagHostObject.ts';

const commands = vi.hoisted(() => ({
  mixdownStart: vi.fn(),
  mixdownCancel: vi.fn(),
}));
const library = vi.hoisted(() => ({ shareExport: vi.fn() }));

vi.mock('./NativeKitbagCommands', () => ({
  getKitbagCommands: () => commands,
}));
vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const {
  mixdownCancel,
  mixdownProgress,
  mixdownStart,
  mixdownState,
  shareExport,
} = await import('./mixdown.ts');

const PATH = '/cache/exports/Song - Band.wav';
const host = { mixdown_progress: 0, mixdown_state: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { [KITBAG_HOST_OBJECT_KEY]: host });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, KITBAG_HOST_OBJECT_KEY);
});

it('hands back the path of a render that started', async () => {
  commands.mixdownStart.mockResolvedValue({
    result: KB_RESULT.KB_OK,
    path: PATH,
  });

  await expect(mixdownStart('Song - Band.wav')).resolves.toEqual({
    result: KB_RESULT.KB_OK,
    path: PATH,
  });
  expect(commands.mixdownStart).toHaveBeenCalledExactlyOnceWith(
    'Song - Band.wav',
  );
});

it('hands back no path when the render was refused', async () => {
  commands.mixdownStart.mockResolvedValue({
    result: KB_RESULT.KB_ERROR_NO_SPACE,
    path: PATH,
  });

  await expect(mixdownStart('Song - Band.wav')).resolves.toEqual({
    result: KB_RESULT.KB_ERROR_NO_SPACE,
  });
});

it('cancels through the command module', () => {
  mixdownCancel();

  expect(commands.mixdownCancel).toHaveBeenCalledOnce();
});

it('shares the exported file', async () => {
  library.shareExport.mockResolvedValue(undefined);

  await shareExport(PATH);

  expect(library.shareExport).toHaveBeenCalledExactlyOnceWith(PATH);
});

it('reads a result the engine never sends as an internal failure', async () => {
  commands.mixdownStart.mockResolvedValue({ result: 99, path: PATH });

  await expect(mixdownStart('Song - Band.wav')).resolves.toEqual({
    result: KB_RESULT.KB_ERROR_INTERNAL,
  });
});

it('reads progress and state from the host object', () => {
  host.mixdown_progress = 0.375;
  host.mixdown_state = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_CANCELLED;

  expect(mixdownProgress()).toBe(0.375);
  expect(mixdownState()).toBe(KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_CANCELLED);
});

it('reads a state the engine never sends as idle', () => {
  host.mixdown_state = 99;

  expect(mixdownState()).toBe(KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_IDLE);
});
