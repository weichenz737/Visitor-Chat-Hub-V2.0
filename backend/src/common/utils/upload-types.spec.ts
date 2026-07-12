import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { assertFileMagicMatchesExtension } from '../../common/utils/upload-types';

describe('assertFileMagicMatchesExtension', () => {
  const files: string[] = [];

  afterEach(() => {
    for (const file of files.splice(0)) {
      if (existsSync(file)) unlinkSync(file);
    }
  });

  function writeTemp(name: string, bytes: number[]) {
    const path = join(tmpdir(), `cs-magic-${Date.now()}-${name}`);
    writeFileSync(path, Buffer.from(bytes));
    files.push(path);
    return path;
  }

  it('accepts a real PNG header for .png', () => {
    const path = writeTemp(
      'ok.png',
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0],
    );
    expect(() => assertFileMagicMatchesExtension(path, 'photo.png')).not.toThrow();
    expect(existsSync(path)).toBe(true);
  });

  it('rejects a text file disguised as .png and deletes it', () => {
    const path = writeTemp('bad.png', [...Buffer.from('not-a-png')]);
    expect(() => assertFileMagicMatchesExtension(path, 'photo.png')).toThrow(
      'FILE_MAGIC_MISMATCH',
    );
    expect(existsSync(path)).toBe(false);
  });

  it('accepts jpeg SOI marker', () => {
    const path = writeTemp('ok.jpg', [0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(() =>
      assertFileMagicMatchesExtension(path, 'shot.jpg'),
    ).not.toThrow();
  });

  it('skips magic checks for .txt', () => {
    const path = writeTemp('note.txt', [...Buffer.from('hello')]);
    expect(() =>
      assertFileMagicMatchesExtension(path, 'note.txt'),
    ).not.toThrow();
  });
});
