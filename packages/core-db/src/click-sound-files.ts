export interface ClickSoundFiles {
  read(fileName: string): Promise<string>;
  write(fileName: string, wav: string): Promise<void>;
  remove(fileName: string): Promise<void>;
}

const WAV_EXTENSION = '.wav';

export const freshClickSoundFileName = () =>
  `${crypto.randomUUID()}${WAV_EXTENSION}`;
