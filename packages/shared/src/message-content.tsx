import type { Message } from './index';
import {
  formatFileSize,
  getFileDisplayName,
  getFileSize,
  getFileUrl,
} from './file-message';
import { fetchAuthMediaBlobUrl, useAuthMediaUrl } from './auth-media';

function FileIcon() {
  return (
    <svg
      className="file-card-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
    </svg>
  );
}

function FileMessageCard({ msg }: { msg: Message }) {
  const name = getFileDisplayName(msg);
  const size = formatFileSize(getFileSize(msg));
  const url = getFileUrl(msg);

  const handleDownload = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    try {
      const blobUrl = await fetchAuthMediaBlobUrl(url);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="file-card">
      <div className="file-card-icon-wrap">
        <FileIcon />
      </div>
      <div className="file-card-body">
        <div className="file-card-name" title={name}>
          {name}
        </div>
        <div className="file-card-size">{size}</div>
      </div>
      <a
        href={url}
        onClick={handleDownload}
        className="file-card-download"
        download={name}
      >
        下载
      </a>
    </div>
  );
}

function AuthImage({ url, alt }: { url: string; alt: string }) {
  const { src, loading, error } = useAuthMediaUrl(url);
  if (error) return <span className="media-error">图片加载失败</span>;
  if (loading || !src) return <span className="media-loading">加载中…</span>;
  return <img src={src} alt={alt} loading="lazy" />;
}

function AuthVideo({ url }: { url: string }) {
  const { src, loading, error } = useAuthMediaUrl(url);
  if (error) return <span className="media-error">视频加载失败</span>;
  if (loading || !src) return <span className="media-loading">加载中…</span>;
  return <video src={src} controls preload="metadata" playsInline />;
}

export function MessageContent({ msg }: { msg: Message }) {
  // Remount when media identity changes so auth blob / file card refresh.
  const mediaKey = `${msg.id}:${msg.content}:${msg.file_name ?? ''}:${msg.file_size ?? ''}`;
  switch (msg.type) {
    case 'IMAGE':
      return <AuthImage key={mediaKey} url={getFileUrl(msg)} alt="图片" />;
    case 'VIDEO':
      return <AuthVideo key={mediaKey} url={getFileUrl(msg)} />;
    case 'FILE':
      return <FileMessageCard key={mediaKey} msg={msg} />;
    default:
      return <>{msg.content}</>;
  }
}

export { getFileDisplayName, formatFileSize } from './file-message';
