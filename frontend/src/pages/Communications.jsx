import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

function getAvatar(contact) {
  const ch = (contact.channel || '').toUpperCase();
  if (ch === 'WHATSAPP') return { cls: 'avatar-whatsapp', icon: '💬' };
  if (ch === 'EMAIL') return { cls: 'avatar-email', icon: '✉️' };
  return { cls: 'avatar-default', icon: '👤' };
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTs(iso) {
  try { return format(new Date(iso), 'HH:mm'); } catch { return ''; }
}

export default function Communications() {
  const [contacts, setContacts] = useState([]);
  const [thread, setThread] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getContacts()
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  const selectContact = async (c) => {
    setSelected(c);
    if (!c.lead_id) { setThread([c]); return; }
    setThreadLoading(true);
    try { setThread(await api.getThread(c.lead_id)); }
    catch { setThread([c]); }
    finally { setThreadLoading(false); }
  };

  const filtered = contacts
    .filter(c => filter === 'ALL' || c.channel === filter)
    .filter(c => !search || (c.sender_name || c.sender_contact || '').toLowerCase().includes(search.toLowerCase()));

  const channelBadge = (ch) => {
    if (ch === 'WHATSAPP') return <span className="badge badge-whatsapp" style={{ fontSize: '0.6rem' }}>WA</span>;
    if (ch === 'EMAIL') return <span className="badge badge-email" style={{ fontSize: '0.6rem' }}>Email</span>;
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Communications</h1>
          <p>All inbound WhatsApp & Email messages in one place.</p>
        </div>
        <div className="filters-row" style={{ margin: 0 }}>
          {['ALL', 'EMAIL', 'WHATSAPP'].map(f => (
            <button key={f} className={`filter-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f === 'ALL' ? 'All' : f}</button>
          ))}
        </div>
      </div>

      <div className="split-panel">
        {/* Contact list */}
        <div className="split-left">
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="search-bar" style={{ maxWidth: '100%' }}>
              <Search size={13} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={24} />
              <h3>No messages</h3>
            </div>
          ) : (
            filtered.map(c => {
              const av = getAvatar(c);
              const isActive = selected?.id === c.id;
              return (
                <div key={c.id} className={`contact-item${isActive ? ' active' : ''}`} onClick={() => selectContact(c)}>
                  <div className={`contact-avatar ${av.cls}`}>{av.icon}</div>
                  <div className="contact-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span className="contact-name">{c.sender_name || c.sender_contact || 'Unknown'}</span>
                      {channelBadge(c.channel)}
                    </div>
                    <div className="contact-preview">{c.body?.slice(0, 60) || c.subject || '—'}</div>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>{formatTs(c.timestamp)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Thread panel */}
        <div className="split-right">
          {!selected ? (
            <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
              <MessageSquare size={36} style={{ opacity: .2 }} />
              <h3>Select a conversation</h3>
              <p>Click a contact on the left to view their message thread.</p>
            </div>
          ) : (
            <>
              <div className="thread-header">
                <div className={`contact-avatar ${getAvatar(selected).cls}`} style={{ width: 32, height: 32, fontSize: '0.72rem' }}>
                  {getAvatar(selected).icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selected.sender_name || selected.sender_contact}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selected.sender_contact}</div>
                </div>
                {selected.channel === 'EMAIL' ? <Mail size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} /> : <MessageSquare size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />}
              </div>

              <div className="thread-messages">
                {threadLoading ? (
                  <div className="loading-spinner"><div className="spinner" /></div>
                ) : thread.map(msg => (
                  <div key={msg.id}>
                    {msg.subject && (
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, padding: '0 4px' }}>
                        Subject: {msg.subject}
                      </div>
                    )}
                    <div className={`message-bubble ${msg.is_inbound !== false ? 'inbound' : 'outbound'}`}>
                      {msg.body}
                    </div>
                    <div className="message-meta" style={{ textAlign: msg.is_inbound !== false ? 'left' : 'right', padding: '2px 4px' }}>
                      {format(new Date(msg.timestamp), 'dd.MM.yyyy HH:mm')}
                      {msg.ai_summary && <span style={{ marginLeft: 6, color: 'var(--brand-600)' }}>· AI: {msg.ai_summary}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
