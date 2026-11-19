export interface ClickSoundFiles {
  read(fileName: string): Promise<string>;
  write(fileName: string, wavBase64: string): Promise<void>;
  remove(fileName: string): Promise<void>;
}

const WAV_EXTENSION = '.wav';

export const freshClickSoundFileName = () =>
  `${crypto.randomUUID()}${WAV_EXTENSION}`;
