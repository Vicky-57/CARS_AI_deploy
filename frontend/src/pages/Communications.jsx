import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search, MessageCircle, User } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

function getAvatar(contact) {
  const ch = (contact.channel || '').toUpperCase();
  if (ch === 'WHATSAPP') return { cls: 'avatar-whatsapp', icon: <MessageCircle size={16} /> };
  if (ch === 'EMAIL') return { cls: 'avatar-email', icon: <Mail size={16} /> };
  return { cls: 'avatar-default', icon: <User size={16} /> };
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTs(iso) {
  try { return format(new Date(iso), 'HH:mm'); } catch { return ''; }
}

const DUMMY_DATA = [
  {
    id: 'dummy-1',
    channel: 'WHATSAPP',
    sender_name: 'Maximilian Lorenz',
    sender_contact: '+49 8404 9385840',
    body: 'Hello! I am highly interested in the Porsche you have listed. Is it still available for a test drive this weekend?',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    is_inbound: true,
    ai_summary: 'Interested in test drive'
  },
  {
    id: 'dummy-2',
    channel: 'EMAIL',
    sender_name: 'Sarah Schmidt',
    sender_contact: 'sarah.schmidt@example.de',
    subject: 'Inquiry: VW Multivan Comfortline',
    body: 'Hi, I saw your listing for the VW Multivan. Could you please send me the full service history and some interior pictures? Thanks!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    is_inbound: true,
    ai_summary: 'Requesting service history and photos'
  },
  {
    id: 'dummy-3',
    channel: 'WHATSAPP',
    sender_name: 'Klaus Fischer',
    sender_contact: '+49 151 2345678',
    body: 'Thanks for sending over the contracts. I will review them with my wife tonight and sign them tomorrow morning.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    is_inbound: true,
  }
];

export default function Communications() {
  const [contacts, setContacts] = useState([]);
  const [thread, setThread] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getCommunications()
      .then(res => {
        const actualData = Array.isArray(res) ? res : [];
        setContacts([...DUMMY_DATA, ...actualData]);
      })
      .catch(() => setContacts(DUMMY_DATA))
      .finally(() => setLoading(false));
  }, []);

  const selectContact = async (c) => {
    setSelected(c);
    
    // Handle dummy data specifically to show a fake thread
    if (c.id.startsWith('dummy-')) {
      setThreadLoading(true);
      setTimeout(() => {
        setThread([
          c,
          { 
            id: c.id + '-reply', 
            is_inbound: false, 
            body: c.channel === 'WHATSAPP' ? 'Absolutely, I will arrange that for you right away!' : 'Sure Sarah, I have attached the documents to this email.', 
            timestamp: new Date().toISOString(),
            sender_name: 'Admin',
            channel: c.channel
          }
        ]);
        setThreadLoading(false);
      }, 300);
      return;
    }

    if (!c.lead_id) { setThread([c]); return; }
    
    setThreadLoading(true);
    try { 
      const messages = await api.getCommunications({ lead_id: c.lead_id });
      setThread(messages.reverse());
    }
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

              <div className={selected.channel === 'WHATSAPP' ? 'wa-chat-bg' : selected.channel === 'EMAIL' ? 'email-thread-bg' : 'thread-messages'}>
                {threadLoading ? (
                  <div className="loading-spinner"><div className="spinner" /></div>
                ) : selected.channel === 'WHATSAPP' ? (
                  // WhatsApp View
                  thread.map(msg => (
                    <div key={msg.id} className={`wa-bubble ${msg.is_inbound !== false ? 'inbound' : 'outbound'}`}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                      <div className="wa-time">
                        {format(new Date(msg.timestamp), 'HH:mm')}
                        {msg.is_inbound === false && <span style={{ color: '#53bdeb', letterSpacing: '-2px', fontSize: '0.8rem', marginLeft: 2 }}>✓✓</span>}
                      </div>
                      {msg.ai_summary && msg.is_inbound !== false && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--brand-600)', marginTop: 4, borderTop: '1px solid #f0f0f0', paddingTop: 6, fontWeight: 500 }}>
                          ✨ {msg.ai_summary}
                        </div>
                      )}
                    </div>
                  ))
                ) : selected.channel === 'EMAIL' ? (
                  // Email View
                  thread.map(msg => (
                    <div key={msg.id} className="email-card">
                      <div className="email-header-top">
                        <div>
                          <div className="email-subject">{msg.subject || selected.subject || 'No Subject'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span className="email-sender">{msg.is_inbound !== false ? (msg.sender_name || 'Client') : 'Admin'}</span>
                            <span className="email-contact">&lt;{msg.is_inbound !== false ? (msg.sender_contact || '') : 'admin@caragents.com'}&gt;</span>
                          </div>
                        </div>
                        <div className="email-time">
                          {format(new Date(msg.timestamp), 'MMM d, yyyy, h:mm a')}
                        </div>
                      </div>
                      <div className="email-body-text">{msg.body}</div>
                      {msg.ai_summary && msg.is_inbound !== false && (
                        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--brand-50)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--brand-700)', border: '1px solid var(--brand-100)' }}>
                          <strong>✨ AI Summary:</strong> {msg.ai_summary}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  // Fallback View
                  thread.map(msg => (
                    <div key={msg.id}>
                      <div className={`message-bubble ${msg.is_inbound !== false ? 'inbound' : 'outbound'}`}>
                        {msg.body}
                      </div>
                      <div className="message-meta" style={{ textAlign: msg.is_inbound !== false ? 'left' : 'right', padding: '2px 4px' }}>
                        {format(new Date(msg.timestamp), 'dd.MM.yyyy HH:mm')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
