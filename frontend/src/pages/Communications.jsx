import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search, MessageCircle, User, Sparkles, RefreshCw, CheckCircle2, ChevronLeft, Clock, Zap, ShieldCheck } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

function getAvatar(contact) {
  const ch = (contact.channel || '').toUpperCase();
  if (ch === 'WHATSAPP') return { cls: 'avatar-whatsapp', icon: <MessageCircle size={16} /> };
  if (ch === 'EMAIL' || ch === 'OUTLOOK_EMAIL') return { cls: 'avatar-email', icon: <Mail size={16} /> };
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
      // Fetch Supabase logged communications & existing leads
      const [supabaseComms, existingLeads] = await Promise.all([
        api.getCommunications().catch(() => []),
        api.getLeads().catch(() => [])
      ]);
      
      const leadEmailSet = new Set(existingLeads.map(l => (l.email || '').toLowerCase()));
      const initialConvertedMap = {};

      const seenKeys = new Set();
      const uniqueContacts = [];

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
      await api.createLead({
        name: msg.sender_name || 'Inbound Lead',
        email: msg.sender_contact,
        channel: 'EMAIL',
        intent: msg.intent || 'BUY_INTENT',
        status: 'NEW',
        message: msg.body,
        notes: 'Converted from Communications UI'
      });
      alert(`Successfully converted message from ${msg.sender_name || msg.sender_contact} into a Lead!`);
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
    if (ch === 'EMAIL' || ch === 'OUTLOOK_EMAIL') return <span className="badge badge-email" style={{ fontSize: '0.6rem' }}>Email</span>;
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Communications Inbox</h1>
          <p>Live Primary Inbox (Strato IMAP & Outlook) + WhatsApp Cloud API Integration</p>
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

      {contacts.length === 0 && !loading ? (
        /* Dynamic "Coming Soon / Realtime Stream Ready" State when no messages are in DB */
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center', maxWidth: 840, margin: '20px auto', borderRadius: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-50)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Sparkles size={32} color="var(--brand-600)" />
          </div>
          <div style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', padding: '4px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, marginBottom: 16 }}>
            ⚡ Dynamic Live Inbox — Ready for Streaming
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
            No Static Sample Messages
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: 620, margin: '0 auto 32px', lineHeight: 1.6 }}>
            All static mock data has been purged. Inbound emails from <strong>info@car-agents.de</strong> (via Strato/Outlook IMAP) and <strong>WhatsApp Cloud API</strong> webhooks will dynamically populate here in real-time as leads message in.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, textAlign: 'left', marginBottom: 32 }}>
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 18, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#1e40af' }}>
                <Mail size={16} color="#2563eb" /> Strato / Outlook Email Poller
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Polls <strong>info@car-agents.de</strong> every 5 minutes, auto-extracts vehicle inquiries, and classifies <code>BUY_INTENT</code> vs <code>SELL_INTENT</code>.
              </div>
            </div>

            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 18, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#166534' }}>
                <MessageCircle size={16} color="#25D366" /> Meta WhatsApp Cloud API
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Listens to incoming WhatsApp text messages and voice notes, with Whisper audio transcription & automated scheduling assistant.
              </div>
            </div>

            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 18, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#9333ea' }}>
                <Sparkles size={16} color="#9333ea" /> 1-Click AI Lead Conversion
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Instantly converts incoming email threads and WhatsApp conversations into active Lead database records with 1 click.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`split-panel ${selected ? 'thread-active' : ''}`}>
          {/* Contact list */}
          <div className="split-left">
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)' }}>
              <div className="search-bar" style={{ maxWidth: '100%' }}>
                <Search size={13} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages & contacts…" />
              </div>
            </div>

            {loading ? (
              <div className="loading-spinner"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={24} />
                <h3>No messages match filter</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Try selecting another filter or clear search.</p>
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
                <p>Click a message thread to view full details & convert to Lead.</p>
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
                  
                  <button
                    className={`btn ${convertedMap[selected.id] ? 'btn-success' : 'btn-primary'} btn-sm`}
                    style={{ marginLeft: 'auto' }}
                    onClick={() => handleConvertToLead(selected)}
                    disabled={converting || convertedMap[selected.id]}
                  >
                    {convertedMap[selected.id] ? <CheckCircle2 size={13} /> : <Sparkles size={13} />}
                    <span className="hide-on-mobile">{convertedMap[selected.id] ? 'Auto-Converted to Lead' : 'Convert to Lead (AI)'}</span>
                    <span className="show-on-mobile">{convertedMap[selected.id] ? 'Converted' : 'Convert'}</span>
                  </button>
                </div>

                <div className={selected.channel === 'WHATSAPP' ? 'wa-chat-bg' : 'email-thread-bg'}>
                  {threadLoading ? (
                    <div className="loading-spinner"><div className="spinner" /></div>
                  ) : selected.channel === 'WHATSAPP' ? (
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
      )}
    </div>
  );
}
