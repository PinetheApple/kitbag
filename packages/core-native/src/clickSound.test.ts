import { beforeEach, expect, it, vi } from 'vitest';

import {
  KB_CUSTOM_SOUND_SLOTS,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';

const commands = vi.hoisted(() => ({
  loadCustomSound: vi.fn(),
  clearCustomSound: vi.fn(),
  customSoundLoaded: vi.fn(),
}));
const library = vi.hoisted(() => ({ prepareClickSound: vi.fn() }));

vi.mock('./NativeKitbagCommands', () => ({
  getKitbagCommands: () => commands,
}));
vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const {
  clearCustomSound,
  customSoundLoaded,
  loadCustomSound,
  prepareClickSound,
} = await import('./clickSound.ts');

const SOURCE = 'content://picked/rimshot.flac';
const FILE = 'sound-a.wav';
const LAST_SLOT = KB_CUSTOM_SOUND_SLOTS - 1;
const UNKNOWN_RESULT = 99;
const OUT_OF_RANGE_SLOTS = [-1, KB_CUSTOM_SOUND_SLOTS, 0.5, Number.NaN];

beforeEach(() => {
  vi.clearAllMocks();
});

it('prepares through the library module and hands back its refusal', async () => {
  library.prepareClickSound.mockResolvedValue(KB_RESULT.KB_ERROR_SILENT);

  await expect(prepareClickSound(SOURCE, FILE)).resolves.toBe(
    KB_RESULT.KB_ERROR_SILENT,
  );
  expect(library.prepareClickSound).toHaveBeenCalledExactlyOnceWith(
    SOURCE,
    FILE,
  );
});

it.each([
  KB_RESULT.KB_OK,
  KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
  KB_RESULT.KB_ERROR_TOO_LONG,
  KB_RESULT.KB_ERROR_SILENT,
  KB_RESULT.KB_ERROR_NO_SPACE,
  KB_RESULT.KB_ERROR_INTERNAL,
])('passes the documented prepare result %i through', async (result) => {
  library.prepareClickSound.mockResolvedValue(result);

  await expect(prepareClickSound(SOURCE, FILE)).resolves.toBe(result);
});

it.each([KB_RESULT.KB_ERROR_BUSY, UNKNOWN_RESULT])(
  'reads prepare result %i, which the core never sends, as internal',
  async (result) => {
    library.prepareClickSound.mockResolvedValue(result);

    await expect(prepareClickSound(SOURCE, FILE)).resolves.toBe(
      KB_RESULT.KB_ERROR_INTERNAL,
    );
  },
);

it('loads into a slot through the command module', async () => {
  commands.loadCustomSound.mockResolvedValue(KB_RESULT.KB_ERROR_TOO_LONG);

  await expect(loadCustomSound(LAST_SLOT, FILE)).resolves.toBe(
    KB_RESULT.KB_ERROR_TOO_LONG,
  );
  expect(commands.loadCustomSound).toHaveBeenCalledExactlyOnceWith(
    LAST_SLOT,
    FILE,
  );
});

it('reads a load result the core never sends as internal', async () => {
  commands.loadCustomSound.mockResolvedValue(KB_RESULT.KB_ERROR_SILENT);

  await expect(loadCustomSound(0, FILE)).resolves.toBe(
    KB_RESULT.KB_ERROR_INTERNAL,
  );
});

it.each(OUT_OF_RANGE_SLOTS)(
  'refuses slot %d without reaching the engine',
  async (slot) => {
    await expect(loadCustomSound(slot, FILE)).resolves.toBe(
      KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
    );
    clearCustomSound(slot);
    await expect(customSoundLoaded(slot)).resolves.toBe(false);

    expect(commands.loadCustomSound).not.toHaveBeenCalled();
    expect(commands.clearCustomSound).not.toHaveBeenCalled();
    expect(commands.customSoundLoaded).not.toHaveBeenCalled();
  },
);

it('clears and polls a slot through the command module', async () => {
  commands.customSoundLoaded.mockResolvedValue(true);

  clearCustomSound(LAST_SLOT);

  await expect(customSoundLoaded(LAST_SLOT)).resolves.toBe(true);
  expect(commands.clearCustomSound).toHaveBeenCalledExactlyOnceWith(LAST_SLOT);
  expect(commands.customSoundLoaded).toHaveBeenCalledExactlyOnceWith(LAST_SLOT);
});
