import { useState, useEffect } from 'react';
import { Mail, MessageSquare, Search, MessageCircle, User, Sparkles, RefreshCw, CheckCircle2, ChevronLeft, Send, ExternalLink, X } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';
import EmailViewCard from '../components/EmailViewCard';
import toast from 'react-hot-toast';

function getAvatar(contact) {
  const ch = (contact.channel || '').toUpperCase();
  if (ch === 'TELEGRAM') return { cls: 'avatar-telegram', icon: <Send size={15} /> };
  if (ch === 'EMAIL' || ch === 'OUTLOOK_EMAIL' || ch === 'STRATO_EMAIL') return { cls: 'avatar-email', icon: <img src="/assets/mail (1).png" alt="Email" style={{ width: 24, height: 24, objectFit: 'contain' }} /> };
  return { cls: 'avatar-default', icon: <User size={15} /> };
}

function formatTs(iso) {
  try { return format(new Date(iso), 'HH:mm'); } catch { return ''; }
}

const SPAM_PATTERNS = [
  'facebookmail.com', 'service.tiktok.com', 'stripe.com', 'skool.com',
  'amazon.de', 'business.amazon.de', 'commerzbank.com', 'paypal.de',
  'rtm.autoscout24.com', 'trit.io', 'custcomm.dhl.de', 'service@strato.com',
  'support@finanzcheckpro.de', 'edpvovo7.fqj', 'doctolib'
];

function isSpamMessage(c) {
  const email = (c.sender_contact || '').toLowerCase();
  const name = (c.sender_name || '').toLowerCase();
  return SPAM_PATTERNS.some(p => email.includes(p) || name.includes(p));
}

function cleanText(raw) {
  if (!raw) return '';
  let str = String(raw).replace(/[\ufffd\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ');
  if (/<[a-z][\s\S]*>/i.test(str)) {
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      doc.querySelectorAll('style, script, head, meta, link, noscript, svg').forEach(s => s.remove());
      str = doc.body.textContent || doc.body.innerText || '';
    } catch {
      str = str.replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<[^>]+>/g, ' ');
    }
  }
  return str.replace(/\s+/g, ' ').trim();
}

function cleanBodyDisplay(raw) {
  if (!raw) return '—';
  let str = String(raw).replace(/[\ufffd\uFFFD]+/g, ' ');
  if (/<[a-z][\s\S]*>/i.test(str)) {
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      doc.querySelectorAll('style, script, head, meta, link, noscript, svg').forEach(s => s.remove());
      const clean = doc.body.innerText || doc.body.textContent || '';
      return clean.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
    } catch {
      return str.replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ').trim();
    }
  }
  return str.trim();
}

export default function Communications() {
  const [contacts, setContacts] = useState([]);
  const [thread, setThread] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertedMap, setConvertedMap] = useState({});
  const [filter, setFilter] = useState('EMAIL');
  const [showSpam, setShowSpam] = useState(false);
  const [search, setSearch] = useState('');
  const [pollingEmail, setPollingEmail] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const loadCommunications = async () => {
    setLoading(true);
    try {
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
    } catch {
      setThread([c]);
    } finally {
      setThreadLoading(false);
    }
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
        notes: 'Converted from Communications Inbox'
      });
      setConvertedMap(prev => ({ ...prev, [msg.id]: true }));
      toast.success(`Successfully converted message from ${msg.sender_name || msg.sender_contact} into a Lead.`);
      loadCommunications();
    } catch (err) {
      console.error(err);
      toast.error('Error converting email to lead: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  const handleSyncEmails = async () => {
    setPollingEmail(true);
    try {
      const res = await api.triggerEmailPoll();
      const count = res.processed || 0;
      toast.success(`Strato Inbox Sync Complete: ${count} new email lead(s) processed.`);
      loadCommunications();
    } catch (err) {
      toast.error('Error syncing Strato email inbox: ' + err.message);
    } finally {
      setPollingEmail(false);
    }
  };

  const spamCount = contacts.filter(c => isSpamMessage(c)).length;

  const filtered = contacts
    .filter(c => {
      const isSpam = isSpamMessage(c);
      if (showSpam) {
        if (!isSpam) return false;
      } else {
        if (isSpam) return false;
      }
      if (filter === 'ALL') return true;
      if (filter === 'EMAIL') return c.channel === 'EMAIL' || c.channel === 'OUTLOOK_EMAIL' || c.channel === 'STRATO_EMAIL';
      if (filter === 'TELEGRAM') return c.channel === 'TELEGRAM';
      return c.channel === filter;
    })
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name = (cleanText(c.sender_name) || c.sender_contact || '').toLowerCase();
      const subj = (cleanText(c.subject) || '').toLowerCase();
      const body = (cleanText(c.body) || '').toLowerCase();
      return name.includes(q) || subj.includes(q) || body.includes(q);
    });

  const channelBadge = (ch) => {
    if (ch === 'TELEGRAM') return <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>TG</span>;
    if (ch === 'EMAIL' || ch === 'OUTLOOK_EMAIL' || ch === 'STRATO_EMAIL') return <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Email</span>;
    return null;
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Frappe Workspace Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-left">
          <h1 className="page-title">Communications Inbox</h1>
          <p className="page-subtitle">Live unified inbox (Strato IMAP & Outlook) + Telegram Bot integration</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Channel Tabs */}
          <div style={{ display: 'inline-flex', background: 'var(--border)', padding: 2, borderRadius: 'var(--radius-sm)' }}>
            {['EMAIL', 'TELEGRAM'].map(f => (
              <button key={f} onClick={() => {
                if (f === 'TELEGRAM') setShowTelegramModal(true);
                else setFilter(f);
              }} style={{
                padding: '5px 12px', borderRadius: 4, fontWeight: 600, fontSize: '0.75rem',
                border: 'none', cursor: 'pointer',
                background: filter === f ? 'var(--surface)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: filter === f ? 'var(--shadow-xs)' : 'none',
              }}>{f === 'EMAIL' ? 'EMAIL' : f}</button>
            ))}
          </div>

          <button
            className={`btn btn-sm ${showSpam ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowSpam(!showSpam)}
          >
            {showSpam ? '← Active Inbox' : `Spam (${spamCount})`}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSyncEmails}
            disabled={pollingEmail}
          >
            <Mail size={13} />
            {pollingEmail ? 'Syncing…' : 'Sync Strato'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadCommunications}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className={`split-panel ${selected ? 'thread-active' : ''}`} style={{ flex: 1, minHeight: 0 }}>
        {/* Contact list */}
        <div className="split-left">
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)' }}>
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
              <h3>{showSpam ? 'No filtered spam messages' : 'No messages found'}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {showSpam ? 'Spam folder is clean.' : 'Try selecting another filter or clear search.'}
              </p>
            </div>
          ) : (
            filtered.map(c => {
              const av = getAvatar(c);
              const isActive = selected?.id === c.id;
              const displayName = cleanText(c.sender_name) || c.sender_contact || 'Unknown';
              const preview = cleanText(c.body).slice(0, 65) || cleanText(c.subject) || '—';
              return (
                <div key={c.id} className={`contact-item${isActive ? ' active' : ''}`} onClick={() => {
                  if (c.channel === 'TELEGRAM') setShowTelegramModal(true);
                  else selectContact(c);
                }}>
                  <div className={`contact-avatar ${av.cls}`}>{av.icon}</div>
                  <div className="contact-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span className="contact-name">{displayName}</span>
                      {channelBadge(c.channel)}
                    </div>
                    <div className="contact-preview">{preview}</div>
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
              <MessageSquare size={32} style={{ opacity: .2 }} />
              <h3>Select a conversation</h3>
              <p>Click a message thread to view full details & convert to a CRM Lead.</p>
            </div>
          ) : (
            <>
              <div className="thread-header">
                <button className="btn-icon show-on-mobile" style={{ marginRight: 8, padding: 4 }} onClick={() => setSelected(null)}>
                  <ChevronLeft size={18} />
                </button>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div className={`contact-avatar ${getAvatar(selected).cls}`} style={{ fontSize: '0.7rem' }}>
                    {getAvatar(selected).icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cleanText(selected.sender_name) || selected.sender_contact}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selected.sender_contact}</div>
                  </div>
                </div>

                <button
                  className={`btn ${convertedMap[selected.id] ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                  style={{ marginLeft: 'auto' }}
                  onClick={() => handleConvertToLead(selected)}
                  disabled={converting || convertedMap[selected.id]}
                >
                  {convertedMap[selected.id] ? <CheckCircle2 size={13} /> : <Sparkles size={13} />}
                  <span>{convertedMap[selected.id] ? 'Converted to Lead' : 'Convert to Lead'}</span>
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {threadLoading ? (
                  <div className="loading-spinner"><div className="spinner" /></div>
                ) : selected.channel === 'TELEGRAM' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0088cc', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)' }}>
                      <Send size={32} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Telegram Chatbot</h3>
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Continue this conversation in our dedicated Telegram Bot.</p>
                    </div>
                    <a
                      href="https://t.me/car_agents_bot"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ marginTop: 12, padding: '10px 24px', fontSize: '0.9rem' }}
                    >
                      Open in Telegram <ExternalLink size={14} style={{ marginLeft: 6 }} />
                    </a>
                  </div>
                ) : (
                  // ── Email Thread — Frappe Email Communication View ──
                  <div className="email-thread-bg">
                    {thread.map(msg => (
                      <EmailViewCard
                        key={msg.id}
                        msg={msg}
                        toAddress="info@car-agents.de"
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Telegram Redirect Modal */}
      {showTelegramModal && (
        <div className="modal-overlay" onClick={() => setShowTelegramModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 32, textAlign: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button className="btn-icon" onClick={() => setShowTelegramModal(false)} style={{ position: 'absolute', right: -16, top: -16 }}>
                <X size={18} />
              </button>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#0088cc', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)' }}>
                <Send size={36} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Telegram Chatbot</h3>
              <p style={{ margin: '12px 0 24px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Go to our dedicated Telegram Bot to manage these communications and messages.</p>
              <a
                href="https://t.me/car_agents_bot"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: '0.95rem' }}
                onClick={() => setShowTelegramModal(false)}
              >
                Open in Telegram <ExternalLink size={16} style={{ marginLeft: 8 }} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}