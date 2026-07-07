import type { Message } from './index';

const UUID_BASENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function fixFileNameEncoding(name: string): string {
  if (!name) return name;
  try {
    const bytes = new Uint8Array([...name].map((ch) => ch.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (fixed.includes('\uFFFD')) return name;
    if (fixed !== name && /[\u4e00-\u9fff]/.test(fixed)) return fixed;
    if (fixed !== name && /[^\x00-\x7F]/.test(fixed) && !/[\u4e00-\u9fff]/.test(name)) {
      return fixed;
    }
  } catch {
    /* ignore */
  }
  return name;
}

export function decodeFileName(name?: string | null): string | undefined {
  if (!name?.trim()) return undefined;
  let value = fixFileNameEncoding(name.trim());
  if (/%[0-9A-Fa-f]{2}/.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep current value */
    }
  }
  return value;
}

function isUuidBasename(name: string): boolean {
  const base = name.includes('.')
    ? name.slice(0, name.lastIndexOf('.'))
    : name;
  return UUID_BASENAME.test(base);
}

function readMetaString(
  metadata: Message['metadata'],
  ...keys: string[]
): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function getFileUrl(msg: Message): string {
  return msg.file_url ?? msg.content;
}

export function getFileDisplayName(msg: Message): string {
  const fromField = decodeFileName(msg.file_name);
  if (fromField) return fromField;

  const fromMeta = decodeFileName(
    readMetaString(msg.metadata, 'file_name', 'filename'),
  );
  if (fromMeta) return fromMeta;

  const url = getFileUrl(msg);
  try {
    const segment = new URL(url).pathname.split('/').pop();
    if (segment) {
      const decoded = decodeFileName(segment) ?? segment;
      if (!isUuidBasename(decoded)) return decoded;
    }
  } catch {
    /* ignore invalid URL */
  }

  return '未知文件';
}

export function getFileSize(msg: Message): number | undefined {
  if (typeof msg.file_size === 'number' && msg.file_size > 0) {
    return msg.file_size;
  }
  const meta = msg.metadata;
  if (!meta || typeof meta !== 'object') return undefined;
  const raw = meta.file_size ?? meta.size;
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) return Number(raw);
  return undefined;
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
