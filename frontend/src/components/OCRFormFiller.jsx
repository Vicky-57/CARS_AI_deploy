import React, { useState } from 'react';

export default function OCRFormFiller() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    manufacturer: '',
    model: '',
    vin: '',
    license_plate: '',
    initial_registration: '',
    tuev_until: '',
    owner_name: ''
  });
  const [contractResult, setContractResult] = useState(null);

  const API_BASE = 'http://localhost:9000';

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleOCR = async () => {
    if (!file) return alert('Please select a PDF or image document scan first.');
    setLoading(true);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/v1/ocr/form-fill`, { method: 'POST', body });
      const data = await res.json();
      if (data.form_fields) {
        const f = data.form_fields;
        setFormData({
          manufacturer: f.manufacturer || '',
          model: f.model || '',
          vin: f.vin || '',
          license_plate: f.license_plate || '',
          initial_registration: f.initial_registration || '',
          tuev_until: f.tuev_until || '',
          owner_name: f.owner_name || ''
        });
      }
    } catch (err) {
      alert('OCR Form extraction failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContract = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contracts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: 'CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf',
          fields: formData
        })
      });
      const data = await res.json();
      setContractResult(data);
    } catch (err) {
      alert('Failed to generate contract PDF: ' + err.message);
    }
  };

  return (
    <div className="card">
      <div className="card-title">📄 1-Click Interactive OCR Form Filler & Contract Pre-Filler</div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="dropzone-container" onClick={() => document.getElementById('file-input').click()}>
            <div style={{ fontSize: '2.5rem' }}>📄</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {file ? file.name : 'Click to select Fahrzeugschein / TÜV Scan (PDF/Image)'}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports PDF, PNG, JPG</span>
          </div>
          <input type="file" id="file-input" style={{ display: 'none' }} onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />

          <button className="btn-primary" onClick={handleOCR} disabled={loading}>
            {loading ? '⚡ Running Tesseract OCR & Claude Parsing...' : '⚡ Extract & Pre-Fill Web Form'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Auto-Populated Form Fields</h4>
          
          <div className="grid-2">
            <div className="form-field">
              <label className="form-label">Manufacturer</label>
              <input className="form-input" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="BMW" />
            </div>
            <div className="form-field">
              <label className="form-label">Model</label>
              <input className="form-input" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="320i Sedan" />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-field">
              <label className="form-label">VIN (17 characters)</label>
              <input className="form-input" value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} placeholder="WBA1234567890ABCD" />
            </div>
            <div className="form-field">
              <label className="form-label">License Plate</label>
              <input className="form-input" value={formData.license_plate} onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })} placeholder="M-CA 2026" />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-field">
              <label className="form-label">Erstzulassung</label>
              <input className="form-input" value={formData.initial_registration} onChange={(e) => setFormData({ ...formData, initial_registration: e.target.value })} placeholder="2022-05-15" />
            </div>
            <div className="form-field">
              <label className="form-label">TÜV Until</label>
              <input className="form-input" value={formData.tuev_until} onChange={(e) => setFormData({ ...formData, tuev_until: e.target.value })} placeholder="2027-05" />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Owner Name</label>
            <input className="form-input" value={formData.owner_name} onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })} placeholder="Vikas Kumar" />
          </div>

          <button className="btn-primary btn-success" onClick={handleGenerateContract}>
            📝 Generate Ready-to-Sign Contract PDF
          </button>

          {contractResult && (
            <div className="alert-banner alert-success">
              ✅ <strong>{contractResult.contract_title}</strong> generated & pre-filled!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
