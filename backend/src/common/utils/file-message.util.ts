const UUID_BASENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readMetaString(
  metadata: unknown,
  ...keys: string[]
): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function fixFileNameEncoding(name: string): string {
  if (!name) return name;
  const fixed = Buffer.from(name, 'latin1').toString('utf8');
  if (fixed.includes('\uFFFD')) return name;
  if (fixed !== name && /[\u4e00-\u9fff]/.test(fixed)) return fixed;
  if (fixed !== name && /[^\x00-\x7F]/.test(fixed) && !/[\u4e00-\u9fff]/.test(name)) {
    return fixed;
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

export function resolveFileName(input: {
  fileName?: string | null;
  metadata?: unknown;
  content: string;
}): string {
  const fromField = decodeFileName(input.fileName);
  if (fromField) return fromField;

  const fromMeta = decodeFileName(
    readMetaString(input.metadata, 'file_name', 'filename'),
  );
  if (fromMeta) return fromMeta;

  try {
    const segment = new URL(input.content).pathname.split('/').pop();
    if (segment) {
      const decoded = decodeFileName(segment) ?? segment;
      if (!isUuidBasename(decoded)) return decoded;
    }
  } catch {
    /* ignore invalid URL */
  }

  return '未知文件';
}

export function resolveFileSize(input: {
  fileSize?: number | null;
  metadata?: unknown;
}): number | undefined {
  if (typeof input.fileSize === 'number' && input.fileSize > 0) {
    return input.fileSize;
  }
  const meta = input.metadata;
  if (!meta || typeof meta !== 'object') return undefined;
  const raw =
    (meta as Record<string, unknown>).file_size ??
    (meta as Record<string, unknown>).size;
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) return Number(raw);
  return undefined;
}

export function toMessageDto(message: {
  id: string;
  sessionId: string;
  senderType: string;
  senderId: string | null;
  type: string;
  content: string;
  fileName?: string | null;
  fileSize?: number | null;
  metadata?: unknown;
  createdAt: Date;
  readAt?: Date | null;
  conversationId?: string;
}) {
  const base = {
    id: message.id,
    sessionId: message.sessionId,
    conversationId: message.conversationId,
    senderType: message.senderType,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    metadata: message.metadata ?? null,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  };
  if (message.type === 'TEXT' || message.type === 'SYSTEM') return base;

  const fileName = resolveFileName({
    fileName: message.fileName,
    metadata: message.metadata,
    content: message.content,
  });
  const fileSize =
    resolveFileSize({
      fileSize: message.fileSize,
      metadata: message.metadata,
    }) ?? null;

  if (message.type === 'FILE') {
    return {
      ...base,
      file_url: message.content,
      file_name: fileName,
      file_size: fileSize,
    };
  }

  // IMAGE / VIDEO — still pass name/size when present so admin edits sync cleanly
  return {
    ...base,
    file_url: message.content,
    ...(message.fileName != null ? { file_name: fileName } : {}),
    ...(fileSize != null ? { file_size: fileSize } : {}),
  };
}

export function serializeFileMessage<
  T extends {
    type: string;
    content: string;
    fileName?: string | null;
    fileSize?: number | null;
    metadata?: unknown;
  },
>(msg: T) {
  if (msg.type !== 'FILE') return msg;
  return {
    ...msg,
    file_url: msg.content,
    file_name: resolveFileName(msg),
    file_size: resolveFileSize(msg) ?? null,
  };
}
