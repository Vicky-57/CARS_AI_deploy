import { Sparkles, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { formatContactName } from '../utils/textUtils';

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

  const rawFromName = cleanText(msg.sender_name);
  const fromEmail = (msg.sender_contact || '').trim();
  const friendlyName = formatContactName(rawFromName || fromEmail, fromEmail);
  const subject = cleanText(msg.subject) || '(No Subject)';
  const body = cleanBodyDisplay(msg.body);
  const aiSummary = msg.ai_summary || msg.summary || null;
  const isInbound = msg.is_inbound !== false;
  const ts = msg.timestamp;
  let dateStr = '';
  try { dateStr = format(new Date(ts), 'MMM d, yyyy · HH:mm'); } catch { dateStr = ''; }

  const showEmailAddr = Boolean(fromEmail && fromEmail.toLowerCase() !== friendlyName.toLowerCase());

  return (
    <article className="email-view-card">
      {/* Header — Direction, Date, Subject & Structured From/To Envelope */}
      <div className="email-view-header">
        <div className="email-view-meta">
          <div className="email-view-head-top">
            <span className={`email-dir-pill ${isInbound ? 'in' : 'out'}`}>
              {isInbound ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
              <span>{isInbound ? 'Received (Inbound)' : 'Sent by CAR-AGENTS (Outbound)'}</span>
            </span>
            {dateStr && <span className="email-view-date">{dateStr}</span>}
          </div>

          <h3 className="email-subject-line">{subject}</h3>

          <div className="email-envelope">
            <div className="email-meta-row">
              <span className="email-meta-label">From</span>
              <div className="email-meta-value">
                {isInbound ? (
                  <>
                    <strong>{friendlyName}</strong>
                    {showEmailAddr && <span className="email-meta-addr">{fromEmail}</span>}
                  </>
                ) : (
                  <>
                    <strong>CAR-AGENTS Broker</strong>
                    <span className="email-meta-addr">info@car-agents.de</span>
                  </>
                )}
              </div>
            </div>

            <div className="email-meta-row">
              <span className="email-meta-label">To</span>
              <div className="email-meta-value">
                {isInbound ? (
                  <span className="email-meta-addr strong">{toAddress}</span>
                ) : (
                  <>
                    <strong>{friendlyName}</strong>
                    {showEmailAddr && <span className="email-meta-addr">{fromEmail}</span>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="email-view-body">{body}</div>

      {/* AI Summary (only for inbound) */}
      {aiSummary && isInbound && (
        <div className="email-ai-summary">
          <span className="email-ai-icon">
            <Sparkles size={11} />
          </span>
          <div className="email-ai-text">
            <strong>AI Intent Summary</strong>
            <span>{aiSummary}</span>
          </div>
        </div>
      )}
    </article>
  );
}
