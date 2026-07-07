import type { Message } from './index';
import {
  formatFileSize,
  getFileDisplayName,
  getFileSize,
  getFileUrl,
} from './file-message';

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
        target="_blank"
        rel="noopener noreferrer"
        className="file-card-download"
        download={name}
      >
        下载
      </a>
    </div>
  );
}

export function MessageContent({ msg }: { msg: Message }) {
  switch (msg.type) {
    case 'IMAGE':
      return <img src={msg.content} alt="图片" loading="lazy" />;
    case 'VIDEO':
      return (
        <video src={msg.content} controls preload="metadata" playsInline />
      );
    case 'FILE':
      return <FileMessageCard msg={msg} />;
    default:
      return <>{msg.content}</>;
  }
}

export { getFileDisplayName, formatFileSize } from './file-message';
