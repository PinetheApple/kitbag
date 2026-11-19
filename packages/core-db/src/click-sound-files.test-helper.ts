import type { ClickSoundFiles } from './click-sound-files';

export function memoryClickSoundFiles() {
  const stored = new Map<string, string>();
  const files: ClickSoundFiles = {
    read: (fileName) => {
      const wav = stored.get(fileName);
      return wav === undefined
        ? Promise.reject(new Error(`${fileName} missing`))
        : Promise.resolve(wav);
    },
    write: (fileName, wav) => {
      stored.set(fileName, wav);
      return Promise.resolve();
    },
    remove: (fileName) => {
      stored.delete(fileName);
      return Promise.resolve();
    },
  };
  return { stored, files };
}
