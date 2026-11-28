import { KB_TOOL_INSTALL_STAGE } from '@kitbag/core-native';
import { INSTALL_FAILURE, type ToolJob } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { INSTALLED_CARD } from './toolPageModel.ts';
import {
  builtForValue,
  cardText,
  dataValue,
  deleteDataBody,
  installLabel,
  progressPercent,
  removeBody,
} from './toolPageText.ts';

const NAME = 'Practice recorder';

function job(fields: Partial<ToolJob>): ToolJob {
  return {
    stage: KB_TOOL_INSTALL_STAGE.failed,
    receivedBytes: 0,
    totalBytes: 0,
    failure: null,
    neededBytes: 0,
    freeBytes: 0,
    ...fields,
  };
}

import { formatBytesOf } from './bytes.ts';

describe('tool page values', () => {
  it('names the download size on Install', () => {
    expect(installLabel(1_600_000)).toBe('Install · 1.6 MB');
  });

  it('shares the unit across received and total bytes', () => {
    expect(formatBytesOf(900_000, 1_600_000)).toBe('0.9 of 1.6 MB');
    expect(formatBytesOf(400_000, 1_600_000)).toBe('0.4 of 1.6 MB');
    expect(formatBytesOf(900, 1_200)).toBe('0.9 of 1.2 KB');
  });

  it('turns bytes into a percent, or none while the size is unknown', () => {
    expect(progressPercent(job({ receivedBytes: 1, totalBytes: 4 }))).toBe(25);
    expect(progressPercent(job({ receivedBytes: 1 }))).toBeNull();
  });

  it('gives its data in bytes and items, or None yet', () => {
    expect(dataValue({ bytes: 38_000_000, items: 12 })).toBe(
      '38 MB · 12 items',
    );
    expect(dataValue({ bytes: 0, items: 0 })).toBe('None yet');
  });

  it('names the release the catalogue came with', () => {
    expect(builtForValue('0.31.0')).toBe('This Kitbag (0.31.0)');
  });
});

describe('status cards', () => {
  it('says the tool is installed, and nothing yet about Home (4c)', () => {
    expect(cardText(INSTALLED_CARD, NAME, undefined)).toMatchObject({
      tone: 'success',
      title: 'Installed',
      body: 'Practice recorder is installed.',
    });
  });

  it('says a failed check deleted the file (4e)', () => {
    expect(cardText(INSTALL_FAILURE.check, NAME, undefined)).toMatchObject({
      tone: 'danger',
      icon: 'certificateChanged',
      title: 'Not installed: the check failed',
    });
  });

  it('says where a download stopped (4f)', () => {
    const stopped = job({ receivedBytes: 900_000, totalBytes: 1_600_000 });
    expect(cardText(INSTALL_FAILURE.download, NAME, stopped).body).toBe(
      'The connection dropped at 0.9 of 1.6 MB. Nothing was installed.',
    );
  });

  it('gives the room needed and the room free (4g)', () => {
    const full = job({ neededBytes: 4_100_000, freeBytes: 2_300_000 });
    expect(cardText(INSTALL_FAILURE.noSpace, NAME, full).body).toBe(
      'Practice recorder needs 4.1 MB to install. This phone has 2.3 MB free. Free up space on the phone, then try again.',
    );
  });

  it('says installed tools still work when offline (7a)', () => {
    expect(cardText(INSTALL_FAILURE.offline, NAME, undefined)).toMatchObject({
      tone: 'warning',
      icon: 'wifiOff',
      title: 'No connection',
    });
  });
});

describe('remove text', () => {
  it('says the data stays by default (6b)', () => {
    expect(removeBody(12, false)).toBe(
      'It is removed from this phone. Your 12 items stay, so installing it again brings them back.',
    );
  });

  it('says the data goes when the box is ticked (6c)', () => {
    expect(removeBody(12, true)).toBe(
      'It is removed from this phone and its 12 items are deleted.',
    );
  });

  it('says nothing about data a tool never had', () => {
    expect(removeBody(0, false)).toBe('It is removed from this phone.');
  });
});

describe('delete data confirm', () => {
  it('names what goes and says it cannot be undone', () => {
    expect(deleteDataBody({ bytes: 38_000_000, items: 12 })).toBe(
      'Its 12 items (38 MB) are removed from this phone. This cannot be undone.',
    );
  });
});
