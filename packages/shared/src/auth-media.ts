import { useEffect, useState } from 'react';
import { API_BASE } from './index';

let mediaTokenGetter: (() => string | null) | null = null;

export function setMediaTokenGetter(fn: () => string | null) {
  mediaTokenGetter = fn;
}

function toAuthApiPath(url: string): string | null {
  try {
    const parsed = new URL(url, API_BASE);
    const filesMatch = parsed.pathname.match(/\/files\/([0-9a-f-]{36})$/i);
    if (filesMatch) return `/files/${filesMatch[1]}`;

    const uploadsIdx = parsed.pathname.indexOf('/uploads/');
    if (uploadsIdx !== -1) {
      const storagePath = parsed.pathname.slice(uploadsIdx + '/uploads/'.length);
      return `/files/legacy?path=${encodeURIComponent(storagePath)}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const blobCache = new Map<string, string>();

export async function fetchAuthMediaBlobUrl(url: string): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) return cached;

  const apiPath = toAuthApiPath(url);
  const token = mediaTokenGetter?.();
  if (!apiPath || !token) {
    throw new Error('无法加载受保护文件');
  }

  const res = await fetch(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('文件加载失败');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobCache.set(url, objectUrl);
  return objectUrl;
}

export function useAuthMediaUrl(url: string | undefined | null): {
  src: string | null;
  error: boolean;
  loading: boolean;
} {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchAuthMediaBlobUrl(url)
      .then((objectUrl) => {
        if (!cancelled) {
          setSrc(objectUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { src, error, loading };
}
