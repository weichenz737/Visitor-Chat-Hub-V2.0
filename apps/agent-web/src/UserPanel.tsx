import { useEffect, useState } from 'react';
import { useChatStore } from '@cs/shared/src/store';
import { agentApi, type UserDetail } from './api';
type Props = {
  token: string;
  userId: string | null;
  onSaved?: () => void;
};

export function UserPanel({ token, userId, onSaved }: Props) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const conversationUser = useChatStore((s) =>
    userId && s.conversation?.userId === userId ? s.conversation.user : undefined,
  );  const [presetTags, setPresetTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const api = agentApi(token);

  const load = async (id: string) => {
    const data = await api.getUser(id);
    setUser(data);
    setContent(data.myRemark?.content ?? '');
    setTags(data.myRemark?.tags ?? []);
  };

  useEffect(() => {
    api.visitorTags().then((r) => setPresetTags(r.tags)).catch(() => setPresetTags([]));
  }, [token]);

  useEffect(() => {
    if (userId) load(userId);
    else setUser(null);
  }, [userId, token]);

  useEffect(() => {
    if (!conversationUser || !user || conversationUser.id !== user.id) return;
    setUser((prev) =>
      prev
        ? {
            ...prev,
            nickname: conversationUser.nickname,
            displayName: conversationUser.nickname,
            originalName: conversationUser.originalName ?? prev.originalName,
          }
        : prev,
    );
  }, [conversationUser?.nickname, conversationUser?.originalName, user?.id]);
  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await api.saveRemark(userId, content.trim(), tags);
      await load(userId);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  if (!userId) return <p className="muted">选择会话查看用户资料</p>;
  if (!user) return <p className="muted">加载中...</p>;

  const display = user.displayName ?? user.nickname ?? '访客';
  const original = user.originalName ?? user.visitorLabel;

  return (
    <div className="user-panel">
      <h3>用户资料</h3>
      <div className="user-info-grid">
        <div><span className="label">访客名称</span><strong>{display}</strong></div>
        {original && original !== display && (
          <div><span className="label">系统编号</span>{original}</div>
        )}
        {user.visitorNo && (
          <div><span className="label">访客编号</span>#{user.visitorNo}</div>
        )}
        <div><span className="label">来源</span>{user.source ?? '—'}</div>
        {user.firstSeenAt && (
          <div><span className="label">首次访问</span>{new Date(user.firstSeenAt).toLocaleString()}</div>
        )}
        {user.lastSeenAt && (
          <div><span className="label">最近访问</span>{new Date(user.lastSeenAt).toLocaleString()}</div>
        )}
      </div>

      <h4>备注</h4>
      <textarea
        rows={3}
        placeholder="如：王总，需要报价"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <h4>标签</h4>
      <p className="label" style={{ marginBottom: 6 }}>已选标签（点击 × 删除）</p>
      <div className="selected-tags">
        {tags.length === 0 ? (
          <span className="no-tags-hint">
            {presetTags.length > 0 ? '暂无标签，可从下方快速选择或自定义添加' : '请在企业后台「设置」中配置访客标签'}
          </span>
        ) : (
          tags.map((t) => (
            <span key={t} className="selected-tag">
              {t}
              <button
                type="button"
                className="selected-tag-remove"
                title={`删除标签「${t}」`}
                aria-label={`删除标签 ${t}`}
                onClick={() => removeTag(t)}
              >×</button>
            </span>
          ))
        )}
      </div>

      {presetTags.length > 0 && (
        <>
          <p className="label" style={{ marginBottom: 6 }}>企业预设（来自企业后台）</p>
          <div className="tag-picker">
            {presetTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`tag-chip ${tags.includes(t) ? 'active' : ''}`}
                onClick={() => toggleTag(t)}
              >{tags.includes(t) ? `${t} ✓` : t}</button>
            ))}
          </div>
        </>
      )}

      <div className="tag-add">
        <input
          placeholder="自定义标签"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
        />
        <button type="button" onClick={addCustomTag}>添加</button>
      </div>

      <button type="button" className="save-remark-btn" onClick={save} disabled={saving}>
        {saving ? '保存中...' : '保存备注'}
      </button>
    </div>
  );
}
