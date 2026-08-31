import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search, MessageCircle, User, Sparkles, RefreshCw, CheckCircle2, ChevronLeft, Clock, Zap, ShieldCheck, Inbox } from 'lucide-react';
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

  const [pollingEmail, setPollingEmail] = useState(false);

  const handleSyncEmails = async () => {
    setPollingEmail(true);
    try {
      const res = await api.triggerEmailPoll();
      const count = res.new_leads_created || 0;
      alert(`Strato Inbox Sync Complete! ${count} new email lead(s) processed.`);
      loadCommunications();
    } catch (err) {
      alert('Error syncing Strato email inbox: ' + err.message);
    } finally {
      setPollingEmail(false);
    }
  };

  const filtered = contacts
    .filter(c => {
      if (filter === 'ALL') return true;
      if (filter === 'EMAIL') return c.channel === 'EMAIL' || c.channel === 'OUTLOOK_EMAIL' || c.channel === 'STRATO_EMAIL';
      if (filter === 'WHATSAPP') return c.channel === 'WHATSAPP';
      return c.channel === filter;
    })
    .filter(c => !search || (c.sender_name || c.sender_contact || '').toLowerCase().includes(search.toLowerCase()));

  const channelBadge = (ch) => {
    if (ch === 'WHATSAPP') return <span className="badge badge-whatsapp" style={{ fontSize: '0.6rem' }}>WA</span>;
    if (ch === 'EMAIL' || ch === 'OUTLOOK_EMAIL' || ch === 'STRATO_EMAIL') return <span className="badge badge-email" style={{ fontSize: '0.6rem' }}>Email</span>;
    return null;
  };

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a', margin: '0 0 6px 0' }}>Communications Inbox</h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>Live Primary Inbox (Strato IMAP & Outlook) + WhatsApp Cloud API Integration</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12, flexShrink: 0 }}>
            {['ALL', 'EMAIL', 'WHATSAPP'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 20px', borderRadius: 8, fontWeight: 800, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: filter === f ? '#0f172a' : 'transparent',
                color: filter === f ? '#ffffff' : '#64748b',
                boxShadow: filter === f ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
              }}>{f === 'ALL' ? 'All' : f}</button>
            ))}
          </div>

          <button 
            className="btn" 
            onClick={handleSyncEmails} 
            disabled={pollingEmail}
            style={{ 
              flexShrink: 0, 
              padding: '10px 16px', 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: 10, 
              fontWeight: 700, 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              cursor: pollingEmail ? 'not-allowed' : 'pointer'
            }}
          >
            <Mail size={14} /> 
            {pollingEmail ? 'Syncing Strato Inbox…' : 'Sync Strato Email'}
          </button>

          <button className="btn" onClick={loadCommunications} style={{ flexShrink: 0, padding: '10px 16px', background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Large Hero Card commented out per request
      {contacts.length === 0 && !loading ? (
        <div className="card" style={{ padding: '64px 40px', textAlign: 'center', maxWidth: 880, margin: '40px auto', borderRadius: 24, border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.02)' }}>
          ...
        </div>
      ) : ( */}

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
