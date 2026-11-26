import { useState, useEffect } from 'react';
import { Briefcase, Plus, Mail, Check, Trash2, RefreshCw, Search, ArrowUpRight } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const B2B_STAGES = [
  { value: 'NEW', label: 'New Offer / Inquiry' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'IN_DISCUSSION', label: 'In Discussion' },
  { value: 'ACTIVE_PARTNER', label: 'Active Partner / Deal' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const B2B_TYPES = [
  { value: 'cooperation', label: 'Specific Cooperation Inquiry (§7)' },
  { value: 'general_offer', label: 'General Service Offer (§7)' },
  { value: 'advertising', label: 'Advertising / Marketing' },
];

export default function B2BDeals() {
  const [deals, setDeals] = useState([]);
  const [b2bEmails, setB2bEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    b2b_type: 'cooperation',
    subject: '',
    offer_summary: '',
    status: 'NEW',
    notes: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dealRows, inqRows] = await Promise.all([
        api.getB2BDeals().catch(() => []),
        api.getInquiries(200).catch(() => []),
      ]);
      setDeals(dealRows);
      setB2bEmails(
        inqRows.filter(
          r => r.decision === 'b2b' || ['b2b_cooperation', 'b2b_offer', 'b2b_solicitation', 'b2b_advertising'].includes(r.category)
        )
      );
    } catch (err) {
      toast.error('Failed to load B2B data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_email) {
      toast.error('Company name and contact email are required.');
      return;
    }
    try {
      await api.createB2BDeal(form);
      toast.success(`B2B Deal created for ${form.company_name}`);
      setShowModal(false);
      setForm({
        company_name: '', contact_name: '', contact_email: '', contact_phone: '',
        b2b_type: 'cooperation', subject: '', offer_summary: '', status: 'NEW', notes: '',
      });
      loadAll();
    } catch (err) {
      toast.error('Error creating B2B deal: ' + err.message);
    }
  };

  const handlePromoteEmail = async (mail) => {
    try {
      const email = mail.reply_to || mail.sender_email || '';
      const company = mail.sender_name || (email.includes('@') ? email.split('@')[1] : 'B2B Partner');
      await api.createB2BDeal({
        triage_id: mail.id,
        company_name: company,
        contact_name: mail.sender_name || email,
        contact_email: email,
        b2b_type: mail.category === 'b2b_cooperation' ? 'cooperation' : mail.category === 'b2b_advertising' ? 'advertising' : 'general_offer',
        subject: mail.subject,
        offer_summary: mail.reason || mail.subject,
        status: 'NEW',
        notes: mail.body_preview,
      });
      toast.success(`Converted "${company}" into an active B2B Deal!`);
      loadAll();
    } catch (err) {
      toast.error('Conversion failed: ' + err.message);
    }
  };

  const handleStatusChange = async (dealId, newStatus) => {
    try {
      const updated = await api.updateB2BDeal(dealId, { status: newStatus });
      setDeals(prev => prev.map(d => (d.id === dealId ? updated : d)));
      toast.success(`Stage updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleDelete = async (dealId) => {
    try {
      await api.deleteB2BDeal(dealId);
      setDeals(prev => prev.filter(d => d.id !== dealId));
      toast.success('B2B deal removed');
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  const existingDealEmails = new Set(deals.map(d => (d.contact_email || '').toLowerCase()));
  const filteredDeals = deals.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.company_name || '').toLowerCase().includes(q) ||
      (d.contact_email || '').toLowerCase().includes(q) ||
      (d.subject || '').toLowerCase().includes(q) ||
      (d.offer_summary || '').toLowerCase().includes(q)
    );
  });

  const filteredEmails = b2bEmails.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.sender_name || '').toLowerCase().includes(q) ||
      (m.sender_email || '').toLowerCase().includes(q) ||
      (m.subject || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">B2B Cooperation & Partner Deals (§7)</h1>
          <p className="page-subtitle">
            Dedicated CRM workspace for B2B cooperation inquiries, workshops, appraisers & service offers (retained separately from vehicle leads)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-bar" style={{ width: 240 }}>
            <Search size={13} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search B2B partners & mails…" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} />
            New B2B Deal
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadAll}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Section 1: Active Manual B2B Deals */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={16} />
          Active B2B Deals & Partners ({filteredDeals.length})
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : filteredDeals.length === 0 ? (
          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', padding: '12px 0' }}>
            No B2B deals created yet. Click <strong>"Create B2B Deal"</strong> on any incoming B2B email below or <strong>"+ New B2B Deal"</strong> above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {filteredDeals.map(d => (
              <div key={d.id} className="card" style={{ padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{d.company_name}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {d.contact_name ? `${d.contact_name} · ` : ''}{d.contact_email}
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{d.b2b_type}</span>
                </div>

                {d.subject && (
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 8 }}>{d.subject}</div>
                )}
                {d.offer_summary && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {d.offer_summary.slice(0, 140)}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
                  <select
                    className="input"
                    value={d.status || 'NEW'}
                    onChange={e => handleStatusChange(d.id, e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    {B2B_STAGES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(d.id)}
                    style={{ color: '#dc2626' }}
                    title="Delete B2B Deal"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Incoming B2B Emails Retained by Triage */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={16} />
          Incoming B2B Cooperation & Service Offer Emails ({filteredEmails.length})
        </div>

        {filteredEmails.length === 0 ? (
          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>No B2B emails recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredEmails.map(m => {
              const alreadyDeal = existingDealEmails.has((m.sender_email || '').toLowerCase());
              const dtStr = (() => {
                try { return format(new Date(m.email_date || m.created_at), 'dd.MM.yyyy · HH:mm'); } catch { return ''; }
              })();
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{m.sender_name || m.sender_email}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>&lt;{m.sender_email}&gt;</span>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{m.category}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{dtStr}</span>
                    </div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, marginTop: 4 }}>{m.subject}</div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.reason ? `🤖 ${m.reason} — ` : ''}{(m.body_preview || '').slice(0, 140)}
                    </div>
                  </div>

                  <div>
                    {alreadyDeal ? (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#059669', padding: '5px 10px' }}>
                        <Check size={12} /> In B2B Deals
                      </span>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => handlePromoteEmail(m)}>
                        <ArrowUpRight size={13} />
                        Create B2B Deal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Manual B2B Deal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Create B2B Cooperation / Partner Deal</h3>
            <form onSubmit={handleCreateDeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="input"
                placeholder="Company / Partner Name *"
                value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  className="input"
                  placeholder="Contact Person"
                  value={form.contact_name}
                  onChange={e => setForm({ ...form, contact_name: e.target.value })}
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Contact Email *"
                  value={form.contact_email}
                  onChange={e => setForm({ ...form, contact_email: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select
                  className="input"
                  value={form.b2b_type}
                  onChange={e => setForm({ ...form, b2b_type: e.target.value })}
                >
                  {B2B_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select
                  className="input"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {B2B_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <input
                className="input"
                placeholder="Subject / Offer Title"
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
              />
              <textarea
                className="input"
                rows={4}
                placeholder="Offer summary, terms, or notes…"
                value={form.offer_summary}
                onChange={e => setForm({ ...form, offer_summary: e.target.value })}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save B2B Deal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}