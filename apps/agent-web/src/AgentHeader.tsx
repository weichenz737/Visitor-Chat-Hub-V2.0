import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { AgentStatus } from '@cs/shared';
import { agentApi, STATUS_OPTIONS, type AgentProfile, type AgentStats, type ShareLink } from './api';

type Props = {
  token: string;
  name: string;
  status: AgentStatus;
  connected: boolean;
  onStatusChange: (s: AgentStatus) => void;
  onLogout: () => void;
  onPasswordChanged: () => void;
  onProfileUpdated: (p: Partial<AgentProfile>) => void;
};

export function AgentHeader({
  token,
  name,
  status,
  connected,
  onStatusChange,
  onLogout,
  onPasswordChanged,
  onProfileUpdated,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [share, setShare] = useState<ShareLink | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [modal, setModal] = useState<'password' | 'profile' | 'share' | null>(null);
  const [pwd, setPwd] = useState({ old: '', new1: '', new2: '' });
  const [profile, setProfile] = useState({ name: '', phone: '', email: '' });
  const [pwdError, setPwdError] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const api = agentApi(token);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, [token]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setStatusOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[3];

  const openShare = async () => {
    setMenuOpen(false);
    const data = await api.shareLink();
    setShare(data);
    const url = await QRCode.toDataURL(data.url, { width: 200, margin: 1 });
    setQrDataUrl(url);
    setModal('share');
  };

  const openProfile = async () => {
    setMenuOpen(false);
    const p = await api.profile();
    setProfile({ name: p.name, phone: p.phone ?? '', email: p.email });
    setModal('profile');
  };

  const handleLogout = () => {
    if (window.confirm('确认退出登录？')) onLogout();
  };

  const submitPassword = async () => {
    setPwdError('');
    if (pwd.new1 !== pwd.new2) {
      setPwdError('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(pwd.old, pwd.new1);
      setModal(null);
      setPwd({ old: '', new1: '', new2: '' });
      alert('密码修改成功，请重新登录');
      onPasswordChanged();
    } catch (e) {
      setPwdError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        name: profile.name,
        phone: profile.phone || undefined,
      });
      onProfileUpdated(updated);
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制');
  };

  const downloadQr = (format: 'png' | 'svg') => {
    if (!share) return;
    if (format === 'png' && qrDataUrl) {
      const a = document.createElement('a');
      a.href = qrDataUrl;
      a.download = `客服-${share.agentCode}-二维码.png`;
      a.click();
      return;
    }
    QRCode.toString(share.url, { type: 'svg', margin: 1 }, (_err, svg) => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `客服-${share.agentCode}-二维码.svg`;
      a.click();
    });
  };

  return (
    <header className="agent-header">
      <div className="agent-header-left">
        <h2>客服工作台</h2>
        {stats && (
          <div className="agent-stats-bar">
            <span>今日接待 {stats.todaySessions}</span>
            <span>当前 {stats.activeSessions}</span>
            <span>今日消息 {stats.todayMessages}</span>
          </div>
        )}
      </div>
      <div className="agent-header-right" ref={menuRef}>
        <div className="status-picker">
          <button
            type="button"
            className={`status-btn${connected ? '' : ' disconnected'}`}
            title={connected ? undefined : '网络未连接'}
            onClick={(e) => { e.stopPropagation(); setStatusOpen((v) => !v); setMenuOpen(false); }}
          >
            <span className={`status-dot ${currentStatus.dot}`} />
            {name}
            <span className="status-label">{currentStatus.label}</span>
          </button>
          {statusOpen && (
            <div className="dropdown-menu">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="dropdown-item"
                  onClick={async () => {
                    await api.updateStatus(opt.value);
                    onStatusChange(opt.value);
                    setStatusOpen(false);
                  }}
                >
                  <span className={`status-dot ${opt.dot}`} /> {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="menu-btn" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); setStatusOpen(false); }}>☰</button>
        {menuOpen && (
          <div className="dropdown-menu profile-menu">
            {stats && (
              <div className="agent-stats-menu">
                <div className="dropdown-stats">
                  <span>今日接待 {stats.todaySessions}</span>
                  <span>当前 {stats.activeSessions}</span>
                  <span>今日消息 {stats.todayMessages}</span>
                </div>
              </div>
            )}
            <button type="button" className="dropdown-item" onClick={openProfile}>个人资料</button>
            <button type="button" className="dropdown-item" onClick={() => { setMenuOpen(false); setModal('password'); }}>修改密码</button>
            <button type="button" className="dropdown-item" onClick={openShare}>我的专属链接</button>
            <button type="button" className="dropdown-item danger" onClick={handleLogout}>退出登录</button>
          </div>
        )}
      </div>

      {modal === 'password' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>修改密码</h3>
            <label>原密码<input type="password" value={pwd.old} onChange={(e) => setPwd({ ...pwd, old: e.target.value })} /></label>
            <label>新密码（8~20位，含数字+字母）<input type="password" value={pwd.new1} onChange={(e) => setPwd({ ...pwd, new1: e.target.value })} /></label>
            <label>确认密码<input type="password" value={pwd.new2} onChange={(e) => setPwd({ ...pwd, new2: e.target.value })} /></label>
            {pwdError && <p className="error-text">{pwdError}</p>}
            <div className="modal-actions">
              <button type="button" onClick={submitPassword} disabled={saving}>{saving ? '保存中...' : '确认'}</button>
              <button type="button" className="muted-btn" onClick={() => setModal(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'profile' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>个人资料</h3>
            <label>昵称<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
            <label>手机号<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
            <label>邮箱<input value={profile.email} disabled /></label>
            <div className="modal-actions">
              <button type="button" onClick={submitProfile} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
              <button type="button" className="muted-btn" onClick={() => setModal(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'share' && share && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal card share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>我的专属咨询</h3>
            <p className="muted">访客扫码或打开链接将优先接入您</p>
            <div className="share-url">
              <input readOnly value={share.url} />
              <button type="button" onClick={() => copyText(share.url)}>复制链接</button>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="专属二维码" className="share-qr" />}
            <div className="modal-actions">
              <button type="button" onClick={() => downloadQr('png')}>下载 PNG</button>
              <button type="button" onClick={() => downloadQr('svg')}>下载 SVG</button>
              <button type="button" className="muted-btn" onClick={() => setModal(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
