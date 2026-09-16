import { Sparkles, Mail } from 'lucide-react';
import { format } from 'date-fns';

function cleanBodyDisplay(raw) {
  if (!raw) return '—';
  let str = String(raw).replace(/[\ufffd\uFFFD]+/g, ' ');
  // Aggressively strip style and script tags before parsing to prevent CSS leaks
  str = str.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  str = str.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  if (/<[a-z][\s\S]*>/i.test(str)) {
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      doc.querySelectorAll('style, script, head, meta, link, noscript, svg').forEach(s => s.remove());
      const clean = doc.body.innerText || doc.body.textContent || '';
      return clean.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
    } catch {
      return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return str.trim();
}

function cleanText(raw) {
  if (!raw) return '';
  let str = String(raw).replace(/[\ufffd\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ');
  str = str.replace(/<style[\s\S]*?<\/style>/gi, '');
  str = str.replace(/<script[\s\S]*?<\/script>/gi, '');

  if (/<[a-z][\s\S]*>/i.test(str)) {
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      return doc.body.textContent || '';
    } catch {
      return str.replace(/<[^>]+>/g, ' ');
    }
  }
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * EmailViewCard — Frappe-style read-only email view.
 * Props:
 *   msg        — the message object (sender_name, sender_contact, subject, body, timestamp, ai_summary, is_inbound)
 *   toAddress  — string shown in the "To:" field (default: info@car-agents.de)
 */
export default function EmailViewCard({ msg, toAddress = 'info@car-agents.de' }) {
  if (!msg) return null;

  const fromName    = cleanText(msg.sender_name) || 'Unknown Sender';
  const fromEmail   = msg.sender_contact || '';
  const subject     = cleanText(msg.subject) || '(No Subject)';
  const body        = cleanBodyDisplay(msg.body);
  const aiSummary   = msg.ai_summary || msg.summary || null;
  const isInbound   = msg.is_inbound !== false;
  const ts          = msg.timestamp;
  let   dateStr     = '';
  try { dateStr = format(new Date(ts), 'MMM d, yyyy · HH:mm'); } catch { dateStr = ''; }

  return (
    <div className="email-view-card">
      {/* Header — From / To / Subject */}
      <div className="email-view-header">
        <div className="email-view-meta">
          {/* Subject first — most prominent */}
          <div className="email-subject-line">{subject}</div>

          <div className="email-meta-row" style={{ marginTop: 6 }}>
            <span className="email-meta-label">From</span>
            <span className="email-meta-value">
              {isInbound
                ? <><strong>{fromName}</strong>{fromEmail && ` <${fromEmail}>`}</>
                : <>CAR-AGENTS Broker {'<info@car-agents.de>'}</>
              }
            </span>
          </div>

          <div className="email-meta-row">
            <span className="email-meta-label">To</span>
            <span className="email-meta-value">
              {isInbound
                ? toAddress
                : <>{fromName}{fromEmail && ` <${fromEmail}>`}</>
              }
            </span>
          </div>
        </div>

        <div className="email-view-date">{dateStr}</div>
      </div>

      {/* Body */}
      <div className="email-view-body">{body}</div>

      {/* AI Summary (only for inbound) */}
      {aiSummary && isInbound && (
        <div className="email-ai-summary">
          <Sparkles size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: 2 }}>AI Intent Summary</strong>
            {aiSummary}
          </div>
        </div>
      )}
    </div>
  );
}
