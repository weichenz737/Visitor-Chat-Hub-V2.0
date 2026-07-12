import { extname } from 'path';
import { openSync, readSync, closeSync, unlinkSync } from 'fs';

export const ALLOWED_UPLOAD_TYPES: Record<string, readonly string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.txt': ['text/plain'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

function readFileHeader(filePath: string, length = 16): Buffer {
  const fd = openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(length);
    const bytesRead = readSync(fd, buf, 0, length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

function matchesMagic(
  header: Buffer,
  expected: number[],
  offset = 0,
): boolean {
  if (header.length < offset + expected.length) return false;
  return expected.every((byte, i) => header[offset + i] === byte);
}

/** Validate on-disk magic bytes against extension. Deletes file and throws on mismatch. */
export function assertFileMagicMatchesExtension(
  filePath: string,
  originalName: string,
): void {
  const extension = extname(originalName).toLowerCase();
  if (extension === '.txt') return;

  const header = readFileHeader(filePath, 16);
  let ok = false;

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      ok = matchesMagic(header, [0xff, 0xd8, 0xff]);
      break;
    case '.png':
      ok = matchesMagic(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case '.gif':
      ok =
        matchesMagic(header, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        matchesMagic(header, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      break;
    case '.webp':
      ok =
        matchesMagic(header, [0x52, 0x49, 0x46, 0x46]) &&
        header.length >= 12 &&
        header[8] === 0x57 &&
        header[9] === 0x45 &&
        header[10] === 0x42 &&
        header[11] === 0x50;
      break;
    case '.mp4':
    case '.mov':
      ok =
        header.length >= 8 &&
        header[4] === 0x66 &&
        header[5] === 0x74 &&
        header[6] === 0x79 &&
        header[7] === 0x70;
      break;
    case '.webm':
      ok = matchesMagic(header, [0x1a, 0x45, 0xdf, 0xa3]);
      break;
    case '.pdf':
      ok = matchesMagic(header, [0x25, 0x50, 0x44, 0x46]);
      break;
    case '.zip':
    case '.docx':
    case '.xlsx':
      ok = matchesMagic(header, [0x50, 0x4b, 0x03, 0x04]) ||
        matchesMagic(header, [0x50, 0x4b, 0x05, 0x06]) ||
        matchesMagic(header, [0x50, 0x4b, 0x07, 0x08]);
      break;
    case '.doc':
    case '.xls':
      ok = matchesMagic(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      break;
    default:
      ok = false;
  }

  if (!ok) {
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    throw new Error('FILE_MAGIC_MISMATCH');
  }
}
