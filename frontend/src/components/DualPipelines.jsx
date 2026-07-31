import React, { useState } from 'react';

export default function DualPipelines() {
  const [pipelineType, setPipelineType] = useState('SELL');

  const sellSteps = [
    { num: 1, title: 'Lead Capture & Contract', desc: 'Client onboarded & contract signed' },
    { num: 2, title: 'OCR & Spec Extraction', desc: 'Fahrzeugschein specs parsed' },
    { num: 3, title: 'Marketing & Presentation', desc: 'Photos taken & listing published' },
    { num: 4, title: 'Buyer Inquiry & Test Drives', desc: 'Inquiries answered & appointments set' },
    { num: 5, title: 'Closing & Handover', desc: 'Payment verified & vehicle handed over' }
  ];

  const buySteps = [
    { num: 1, title: 'Requirement Capture', desc: 'Target vehicle specs & budget defined' },
    { num: 2, title: 'Power of Attorney', desc: 'Vollmacht & Procurement agreement' },
    { num: 3, title: 'Car Sourcing & Research', desc: 'Market search & dealer inquiries' },
    { num: 4, title: 'Vehicle Inspection', desc: 'Technical check & TÜV verification' },
    { num: 5, title: 'Purchase & Delivery', desc: 'Negotiation, purchase & client delivery' }
  ];

  const activeSteps = pipelineType === 'SELL' ? sellSteps : buySteps;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="card-title">🏎️ Brokerage Project Pipelines</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {pipelineType === 'SELL'
              ? 'Sell Side (Vermittlung) — Managing client vehicle sales'
              : 'Buy Side (Beschaffung) — Managing client vehicle procurement'}
          </p>
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '100px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setPipelineType('SELL')}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '100px', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              background: pipelineType === 'SELL' ? '#10b981' : 'transparent',
              color: pipelineType === 'SELL' ? 'white' : 'var(--text-secondary)'
            }}
          >
            🏷️ Sell Side (Vermittlung)
          </button>
          <button
            onClick={() => setPipelineType('BUY')}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '100px', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              background: pipelineType === 'BUY' ? '#2563eb' : 'transparent',
              color: pipelineType === 'BUY' ? 'white' : 'var(--text-secondary)'
            }}
          >
            🚗 Buy Side (Beschaffung)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {activeSteps.map((step, idx) => (
          <div
            key={idx}
            style={{
              background: idx <= 1 ? (pipelineType === 'SELL' ? '#ecfdf5' : '#eff6ff') : '#f8fafc',
              border: `1px solid ${idx <= 1 ? (pipelineType === 'SELL' ? '#a7f3d0' : '#bfdbfe') : 'var(--border-color)'}`,
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={`badge-tag ${pipelineType === 'SELL' ? 'badge-green' : 'badge-blue'}`}>
                Step {step.num}
              </span>
              {idx <= 1 && <span style={{ fontSize: '0.75rem', color: 'var(--accent-success)', fontWeight: 700 }}>✓ Active</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{step.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{step.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
