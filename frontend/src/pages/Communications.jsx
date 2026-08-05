import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search, MessageCircle, User, Sparkles, RefreshCw, CheckCircle2, ChevronLeft } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

function getAvatar(contact) {
  const ch = (contact.channel || '').toUpperCase();
  if (ch === 'WHATSAPP') return { cls: 'avatar-whatsapp', icon: <MessageCircle size={16} /> };
  if (ch === 'EMAIL' || ch === 'GMAIL_API') return { cls: 'avatar-email', icon: <Mail size={16} /> };
  return { cls: 'avatar-default', icon: <User size={16} /> };
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
  const [converting, setConverting] = useState(false);
  const [convertedMap, setConvertedMap] = useState({});
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadCommunications = async () => {
    setLoading(true);
    try {
      // 1. Fetch Supabase logged communications & existing leads
      const [supabaseComms, existingLeads] = await Promise.all([
        api.getCommunications().catch(() => []),
        api.getLeads().catch(() => [])
      ]);
      
      const leadEmailSet = new Set(existingLeads.map(l => (l.email || '').toLowerCase()));
      const initialConvertedMap = {};

      // 2. Fetch live Primary Inbox emails from Gmail REST API
      let gmailPrimary = [];
      try {
        if (api.getPrimaryEmails) {
          const gRes = await api.getPrimaryEmails();
          if (gRes && gRes.emails) {
            gmailPrimary = gRes.emails.map(g => ({
              id: g.message_id,
              channel: 'EMAIL',
              sender_name: g.sender_name,
              sender_contact: g.sender_email,
              subject: g.subject,
              body: g.body || g.snippet,
              timestamp: g.date || new Date().toISOString(),
              is_inbound: true,
              is_primary: true
            }));
          }
        }
      } catch (err) {
        console.log('Gmail REST API not authenticated yet or empty.');
      }

      // Deduplicate contacts list so each email thread appears EXACTLY ONCE
      const seenKeys = new Set();
      const uniqueContacts = [];

      // Priority 1: Supabase logged communications (which have AI summary & lead_id attached)
      for (const c of supabaseComms) {
        const key = `${(c.sender_contact || '').toLowerCase()}::${(c.subject || '').toLowerCase().trim()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueContacts.push(c);
          if (c.lead_id || leadEmailSet.has((c.sender_contact || '').toLowerCase())) {
            initialConvertedMap[c.id] = true;
          }
        }
      }

      // Priority 2: Primary Inbox emails from Gmail API
      for (const g of gmailPrimary) {
        const key = `${(g.sender_contact || '').toLowerCase()}::${(g.subject || '').toLowerCase().trim()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const isAlreadyLead = leadEmailSet.has((g.sender_contact || '').toLowerCase());
          if (isAlreadyLead) {
            initialConvertedMap[g.id] = true;
          }
          uniqueContacts.push(g);
        }
      }

      setConvertedMap(initialConvertedMap);
      setContacts(uniqueContacts);
    } catch (err) {
      console.error('Error loading communications:', err);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunications();
  }, []);

  const selectContact = async (c) => {
    setSelected(c);
    
    if (!c.lead_id) { setThread([c]); return; }
    
    setThreadLoading(true);
    try { 
      const messages = await api.getCommunications({ lead_id: c.lead_id });
      setThread(messages.reverse());
    }
    catch { setThread([c]); }
    finally { setThreadLoading(false); }
  };

  const handleConvertToLead = async (msg) => {
    setConverting(true);
    try {
      if (api.convertGmailToLead && msg.id) {
        const res = await api.convertGmailToLead(msg.id);
        alert(res.message || 'Email successfully processed into Lead database!');
      } else {
        await api.createLead({
          name: msg.sender_name,
          email: msg.sender_contact,
          channel: 'EMAIL',
          intent: 'BUY',
          status: 'NEW',
          message: msg.body,
          notes: 'Converted from Primary Email in Communications UI'
        });
        alert(`Successfully converted email from ${msg.sender_name} into a Lead!`);
      }
      setConvertedMap(prev => ({ ...prev, [msg.id]: true }));
      loadCommunications();
    } catch (err) {
      alert('Error converting email to lead: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  const filtered = contacts
    .filter(c => filter === 'ALL' || c.channel === filter)
    .filter(c => !search || (c.sender_name || c.sender_contact || '').toLowerCase().includes(search.toLowerCase()));

  const channelBadge = (ch) => {
    if (ch === 'WHATSAPP') return <span className="badge badge-whatsapp" style={{ fontSize: '0.6rem' }}>WA</span>;
    if (ch === 'EMAIL' || ch === 'GMAIL_API') return <span className="badge badge-email" style={{ fontSize: '0.6rem' }}>Primary Email</span>;
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Communications Inbox</h1>
          <p>Live Primary Inbox emails & WhatsApp conversations with 1-Click AI Lead Conversion</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filters-row" style={{ margin: 0 }}>
            {['ALL', 'EMAIL', 'WHATSAPP'].map(f => (
              <button key={f} className={`filter-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f === 'ALL' ? 'All' : f}</button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={loadCommunications} style={{ flexShrink: 0 }}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <div className={`split-panel ${selected ? 'thread-active' : ''}`}>
        {/* Contact list */}
        <div className="split-left">
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)' }}>
            <div className="search-bar" style={{ maxWidth: '100%' }}>
              <Search size={13} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search primary emails & contacts…" />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={24} />
              <h3>No primary messages</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connected emails and WhatsApp messages will appear here live.</p>
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
              <p>Click a primary email or WhatsApp message to view thread & convert to Lead.</p>
            </div>
          ) : (
            <>
              <div className="thread-header">
                <button className="btn-icon show-on-mobile" style={{ marginRight: 8, padding: 4 }} onClick={() => setSelected(null)}>
                  <ChevronLeft size={20} />
                </button>
                <div className={`contact-avatar ${getAvatar(selected).cls}`} style={{ width: 32, height: 32, fontSize: '0.72rem' }}>
                  {getAvatar(selected).icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selected.sender_name || selected.sender_contact}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selected.sender_contact}</div>
                </div>
                
                {/* Convert / Status Badge */}
                {selected.channel === 'EMAIL' && (() => {
                  const isSystemEmail = ['no-reply', 'noreply', 'accounts.google.com', 'notifications', 'security', 'mailer-daemon'].some(s => (selected.sender_contact || '').toLowerCase().includes(s));
                  if (isSystemEmail) {
                    return <span className="badge badge-secondary" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>System Email</span>;
                  }
                  return (
                    <button
                      className={`btn ${convertedMap[selected.id] ? 'btn-success' : 'btn-primary'} btn-sm`}
                      style={{ marginLeft: 'auto' }}
                      onClick={() => handleConvertToLead(selected)}
                      disabled={converting || convertedMap[selected.id]}
                    >
                      {convertedMap[selected.id] ? <CheckCircle2 size={13} /> : <Sparkles size={13} />}
                      <span className="hide-on-mobile">{convertedMap[selected.id] ? 'Auto-Converted to Lead' : 'Convert Email to Lead (AI)'}</span>
                      <span className="show-on-mobile">{convertedMap[selected.id] ? 'Converted' : 'Convert'}</span>
                    </button>
                  );
                })()}
              </div>

              <div className={selected.channel === 'WHATSAPP' ? 'wa-chat-bg' : 'email-thread-bg'}>
                {threadLoading ? (
                  <div className="loading-spinner"><div className="spinner" /></div>
                ) : selected.channel === 'WHATSAPP' ? (
                  // WhatsApp View
                  thread.map(msg => (
                    <div key={msg.id} className={`wa-bubble ${msg.is_inbound !== false ? 'inbound' : 'outbound'}`}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                      <div className="wa-time">
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </div>
                      {msg.ai_summary && msg.is_inbound !== false && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--brand-600)', marginTop: 4, borderTop: '1px solid #f0f0f0', paddingTop: 6, fontWeight: 500 }}>
                          ✨ {msg.ai_summary}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  // Primary Email View
                  thread.map(msg => (
                    <div key={msg.id} className="email-card" style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
                      <div className="email-header-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                        <div>
                          <div className="email-subject" style={{ fontWeight: 700, fontSize: '1rem' }}>{msg.subject || selected.subject || 'No Subject'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.8rem' }}>
                            <span className="email-sender" style={{ fontWeight: 600 }}>{msg.is_inbound !== false ? (msg.sender_name || 'Client') : 'CAR-AGENTS Assistant'}</span>
                            <span className="email-contact" style={{ color: 'var(--text-muted)' }}>&lt;{msg.is_inbound !== false ? (msg.sender_contact || '') : 'info@car-agents.de'}&gt;</span>
                          </div>
                        </div>
                        <div className="email-time" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {format(new Date(msg.timestamp), 'MMM d, yyyy, h:mm a')}
                        </div>
                      </div>
                      <div className="email-body-text" style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.body}</div>
                      
                      {/* Internal AI Summary Footer inside the Email Box */}
                      {(msg.ai_summary || selected.ai_summary || selected.summary) && msg.is_inbound !== false && (
                        <div style={{
                          marginTop: 16,
                          padding: '12px 16px',
                          background: 'rgba(59, 130, 246, 0.05)',
                          borderRadius: 8,
                          fontSize: '0.8rem',
                          color: '#1e40af',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          lineHeight: 1.5
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, color: '#1e3a8a' }}>
                            <Sparkles size={14} color="#1e3a8a" /> ✨ Internal AI Intent Summary:
                          </div>
                          {msg.ai_summary || selected.ai_summary || selected.summary}
                        </div>
                      )}
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
