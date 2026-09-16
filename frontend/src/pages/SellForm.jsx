import { useState, useEffect } from 'react';
import { Car, CheckCircle, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { api } from '../api/api';

function Field({ label, de, type = 'text', required = false, placeholder = '', full = false, value, onChange, disabled = false }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <input id={id} className="form-input" type={type} required={required} placeholder={placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function SelectField({ label, de, required = false, options = [], value, onChange, disabled = false, full = false }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <select 
        id={id} 
        className="form-select" 
        required={required} 
        value={value ?? ''} 
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: '100%' }}
      >
        <option value="">— Please select / Bitte wählen —</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({ label, de, required = false, placeholder = '', full = false, value, onChange }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <textarea id={id} className="form-textarea" rows={3} required={required} placeholder={placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SectionTitle({ num, en, de }) {
  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 12, marginBottom: 8 }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="badge badge-neutral" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Section {num}</span>
        <span>{en} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>[{de}]</span></span>
      </div>
      <div style={{ height: 1, background: 'var(--border)', marginTop: 8 }} />
    </div>
  );
}

function CheckItem({ label, de, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span>{label} <span style={{ color: 'var(--text-muted)' }}>[{de}]</span></span>
    </label>
  );
}

function ServiceItem({ label, de, priceType = 'number', value, onPriceChange, onBillingChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem', color: 'var(--text-primary)', flexWrap: 'wrap', padding: '6px 0' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!(value && value.price)} onChange={e => onPriceChange(e.target.checked ? '0' : '')} />
        <span>{label} <span style={{ color: 'var(--text-muted)' }}>[{de}]</span></span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Price:</span>
        <input type={priceType} className="form-input" style={{ width: 85, padding: '4px 8px', fontSize: '0.8rem' }} placeholder="€" value={value?.price ?? ''} onChange={e => onPriceChange(e.target.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Billing:</span>
        <select 
          className="form-select" 
          style={{ width: 90, padding: '4px 8px', fontSize: '0.8rem' }} 
          value={value?.billing ?? ''} 
          onChange={e => onBillingChange(e.target.value)}
        >
          <option value="">—</option>
          <option>VK</option>
          <option>VR</option>
          <option>INCL</option>
          <option>SZ</option>
        </select>
      </div>
    </div>
  );
}

const SERVICE_KEYS = ['detailing', 'cleaning', 'hau', 'cert', 'appraisal', 'service', 'pickup', 'transport', 'marketing', 'sorglos', 'storage', 'repair', 'maintenance', 'care'];
const SELL_SERVICE_SLOTS = ['detailing', 'cleaning', 'hau', 'cert', 'appraisal', 'service', 'pickup', 'transport', 'marketing', 'sorglos', 'storage'];

function buildFieldData(form, services) {
  const data = { ...form };
  SELL_SERVICE_SLOTS.forEach((k, i) => {
    const s = services[k];
    if (s && s.price !== '') data[`price_${i + 1}`] = s.price;
  });
  if (services.repair?.price !== '') data.repair_price = services.repair?.price ?? '';
  if (services.maintenance?.price !== '') data.maintenance_price = services.maintenance?.price ?? '';
  if (services.care?.price !== '') data.care_price = services.care?.price ?? '';
  return data;
}

export default function SellForm() {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', street: '', zip_city: '', id_card: '', salutation: '',
    manufacturer: '', model: '', vin: '', license: '', first_date: '', mileage: '', power: '',
    displacement: '', tuev_until: '', owners: '', color: '', zb2: '', gas_until: '', keys: '',
    accident_free: '', accident_details: '', first_engine: '', engine_number: '', engine_mileage: '',
    engine_date: '', commercial: '', reimport: '', origin: '', ownership: '', third_party: '',
    defects: '', special_equipment: '', tires: '', tire_profile: '', wheelset: '', spare: '',
    tread_vl: '', tread_vr: '', tread_hl: '', tread_hr: '',
    min_price: '', final_price: '', package: '', special_agreements: '',
    stored: '', storage_opt: '', keys_handed: '', place: '', date: '',
  });
  const [services, setServices] = useState(Object.fromEntries(SERVICE_KEYS.map(k => [k, { price: '', billing: '' }])));

  const setF = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      api.lookupFormSession(token).then(session => {
        setSessionId(session.id);
        if (session.shared_core) {
          setForm(prev => ({ ...prev, ...session.shared_core }));
        }
      }).catch(() => {});
    }
  }, []);

  const saveStep = async () => {
    if (!sessionId) return true;
    setSaving(true);
    try {
      const core = { full_name: form.full_name, phone: form.phone, email: form.email, street: form.street, zip_city: form.zip_city, id_card: form.id_card };
      await api.saveFormStage(sessionId, {
        stage: step,
        template_type: 'sell_b2c',
        field_data: buildFieldData(form, services),
        shared_core: core,
      });
      setSaving(false);
      return true;
    } catch (e) {
      setSaving(false);
      alert('Could not save progress: ' + e.message);
      return false;
    }
  };

  const goNext = async () => {
    const ok = await saveStep();
    if (ok) setStep(s => Math.min(5, s + 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await saveStep();
    if (ok) setSaved(true);
  };

  const steps = [
    { n: 1, label: 'Personal Details' },
    { n: 2, label: 'Vehicle Specs' },
    { n: 3, label: 'Condition' },
    { n: 4, label: 'Price & Package' },
    { n: 5, label: 'Handover' },
  ];

  if (saved) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)', padding: 32 }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '40px 32px' }}>
          <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700 }}>Thank you! / Vielen Dank!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Your vehicle sales information has been saved. Our broker team will contact you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '32px 16px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8, margin: '0 auto 10px',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}>
            <Car size={22} />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Vehicle Sale Intake / Verkaufsauftrag
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Enter vehicle specifications, history, and sales conditions for brokerage listing
          </p>
        </div>

        {/* Step Progress Bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'var(--border)', padding: 3, borderRadius: 'var(--radius-sm)' }}>
          {steps.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => setStep(s.n)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 4,
                border: 'none',
                background: step === s.n ? 'var(--surface)' : 'transparent',
                color: step === s.n ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: step === s.n ? 'var(--shadow-xs)' : 'none',
                fontWeight: step === s.n ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              Step {s.n}: {s.label}
            </button>
          ))}
        </div>

        {/* Card Form */}
        <div className="card" style={{ padding: '24px 28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            {/* STEP 1: Personal */}
            {step === 1 && (
              <>
                <SectionTitle num={1} en="Personal Details" de="Persönliche Daten" />
                <SelectField label="Salutation" de="Anrede" required options={['Herr / Mr.', 'Frau / Mrs.', 'Divers / Other']} value={form.salutation} onChange={setF('salutation')} />
                <Field label="First & Last Name" de="Name, Vorname" required placeholder="Max Mustermann" value={form.full_name} onChange={setF('full_name')} />
                <Field label="Phone" de="Telefon" required type="tel" placeholder="+49 170 1234567" value={form.phone} onChange={setF('phone')} />
                <Field label="Email" de="E-Mail" required type="email" placeholder="max@example.de" value={form.email} onChange={setF('email')} />
                <Field label="Street, House No." de="Straße, Haus-Nr." required placeholder="Musterstraße 12" value={form.street} onChange={setF('street')} />
                <Field label="ZIP, City" de="PLZ, Ort" required placeholder="93349 Mindelstetten" value={form.zip_city} onChange={setF('zip_city')} />
                <Field label="ID Type / Number" de="Ausweis-Typ/Nr." placeholder="Personalausweis / 123456789" value={form.id_card} onChange={setF('id_card')} />
              </>
            )}

            {/* STEP 2: Vehicle */}
            {step === 2 && (
              <>
                <SectionTitle num={2} en="Vehicle Details" de="Fahrzeugdaten" />
                <Field label="Manufacturer" de="Hersteller" required placeholder="BMW, Audi, VW…" value={form.manufacturer} onChange={setF('manufacturer')} />
                <Field label="Model / Type" de="Modell/Typ" required placeholder="320d xDrive" value={form.model} onChange={setF('model')} />
                <Field label="VIN (17 digits)" de="Fahrzeug-Ident.-Nr. (FIN)" required placeholder="WBA3A51050E123456" value={form.vin} onChange={setF('vin')} />
                <Field label="License Plate" de="Amtl. Kennzeichen" placeholder="EI-TX 420" value={form.license} onChange={setF('license')} />
                <Field label="First Registration" de="Datum der Erstzulassung" type="date" value={form.first_date} onChange={setF('first_date')} />
                <Field label="Mileage (km)" de="Kilometerstand" required type="number" placeholder="75000" value={form.mileage} onChange={setF('mileage')} />
                <Field label="Power (PS/kW)" de="Leistung (PS/kW)" placeholder="184 PS / 135 kW" value={form.power} onChange={setF('power')} />
                <Field label="Displacement (ccm)" de="Hubraum (ccm)" type="number" placeholder="1995" value={form.displacement} onChange={setF('displacement')} />
                <Field label="HU/AU valid until" de="HU/AU gültig bis" type="date" value={form.tuev_until} onChange={setF('tuev_until')} />
                <Field label="Number of Owners" de="Anzahl Halter" type="number" placeholder="2" value={form.owners} onChange={setF('owners')} />
                <Field label="Color / Paint" de="Farbe / Lackart" placeholder="Schwarz / Uni" value={form.color} onChange={setF('color')} />
                <Field label="ZB II Document No." de="Nr. Zulassungsbescheinigung Teil II" placeholder="ABC1234" value={form.zb2} onChange={setF('zb2')} />
              </>
            )}

            {/* STEP 3: Condition */}
            {step === 3 && (
              <>
                <SectionTitle num={3} en="Condition & Declarations" de="Fahrzeugzustand & Erklärungen" />
                <SelectField label="Accident-free?" de="Unfallfreiheit" required options={['Ja / Yes', 'Nein / No']} value={form.accident_free} onChange={setF('accident_free')} />
                <Field label="Accident details (if applicable)" de="Art/Umfang Vorschäden" placeholder="Frontschaden, fachgerecht repariert" full value={form.accident_details} onChange={setF('accident_details')} />
                <SelectField label="Original engine?" de="Erster Motor" options={['Ja / Yes', 'Nein / No']} value={form.first_engine} onChange={setF('first_engine')} />
                <SelectField label="Commercial use?" de="Gewerbliche Nutzung" options={['Nein / No', 'Ja / Yes']} value={form.commercial} onChange={setF('commercial')} />
                <SelectField label="Ownership status" de="Eigentumsverhältnisse" options={['Alleiniges Eigentum / Sole owner', 'Belastet mit Rechten Dritter / Encumbered']} value={form.ownership} onChange={setF('ownership')} />
                <TextAreaField label="Known defects / issues" de="Bekannte Mängel" placeholder="Describe any known defects" full value={form.defects} onChange={setF('defects')} />
                <TextAreaField label="Special equipment & features" de="Sonderausstattung" placeholder="AHK, Panoramadach, Leder..." full value={form.special_equipment} onChange={setF('special_equipment')} />
                <SelectField label="Mounted tires" de="Montierte Bereifung" options={['Sommer / Summer', 'Winter / Winter', 'Allwetter / All-season']} value={form.tires} onChange={setF('tires')} />
                <SelectField label="Tire profile condition" de="Reifenprofil" options={['Neu / New', 'Gut / Good', 'Brauchbar / Usable', 'Verschlissen / Worn']} value={form.tire_profile} onChange={setF('tire_profile')} />
              </>
            )}

            {/* STEP 4: Price & Package */}
            {step === 4 && (
              <>
                <SectionTitle num={4} en="Price & Service Package" de="Preis & Leistungspaket" />
                <Field label="Minimum Sales Price (€)" de="Mindestverkaufspreis (€)" required type="number" placeholder="15000" value={form.min_price} onChange={setF('min_price')} />
                <Field label="Final Purchase Price (€) — for contract" de="Kaufpreis (€)" required type="number" placeholder="16200" value={form.final_price} onChange={setF('final_price')} />
                <SelectField label="Service Package" de="Leistungspaket" required options={[
                  'Essential – €347 (4 weeks)',
                  'Advanced – €1,247 (8 weeks)',
                  'Concierge – €2,497 (12 weeks)',
                ]} value={form.package} onChange={setF('package')} />
                <Field label="Special Agreements" de="Sondervereinbarungen" placeholder="Additional conditions" full value={form.special_agreements} onChange={setF('special_agreements')} />
                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Additional Services:</div>
                  <ServiceItem label="Vehicle detailing" de="Fahrzeugaufbereitung" value={services.detailing} onPriceChange={v => setServices(s => ({ ...s, detailing: { ...s.detailing, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, detailing: { ...s.detailing, billing: v } }))} />
                  <ServiceItem label="Extra cleaning" de="Zusätzliche Reinigung" value={services.cleaning} onPriceChange={v => setServices(s => ({ ...s, cleaning: { ...s.cleaning, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, cleaning: { ...s.cleaning, billing: v } }))} />
                  <ServiceItem label="HU/AU renewal" de="HU/AU-Auffrischung" value={services.hau} onPriceChange={v => setServices(s => ({ ...s, hau: { ...s.hau, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, hau: { ...s.hau, billing: v } }))} />
                  <ServiceItem label="Appraisal / valuation" de="Wertgutachten" value={services.appraisal} onPriceChange={v => setServices(s => ({ ...s, appraisal: { ...s.appraisal, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, appraisal: { ...s.appraisal, billing: v } }))} />
                </div>
              </>
            )}

            {/* STEP 5: Handover */}
            {step === 5 && (
              <>
                <SectionTitle num={5} en="Handover & Documents" de="Übergabe & Dokumente" />
                <SelectField label="Store vehicle with broker during sales period?" de="Fahrzeug beim Makler abgestellt?" required full
                  options={['Ja / Yes', 'Nein / No']} value={form.stored} onChange={setF('stored')} />
                <Field label="Number of keys handed over" de="Anzahl übergebener Schlüssel" type="number" placeholder="2" value={form.keys_handed} onChange={setF('keys_handed')} />
                <div style={{ gridColumn: '1 / -1', padding: '10px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" required checked={!!form.consent} onChange={e => setF('consent')(e.target.checked)} />
                    <span>I confirm the accuracy of the information provided and agree to CAR-AGENTS Terms & Privacy terms.</span>
                  </label>
                </div>
                <Field label="Place / Ort" de="Ort" placeholder="Mindelstetten" value={form.place} onChange={setF('place')} />
                <Field label="Date / Datum" de="Datum" type="date" required value={form.date} onChange={setF('date')} />
              </>
            )}

            {/* Navigation Footer */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || saving}>
                <ChevronLeft size={14} /> Back
              </button>
              {step < 5 ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={goNext} disabled={saving}>
                  {saving ? <Loader size={14} className="spin" /> : <ChevronRight size={14} />} Next Step
                </button>
              ) : (
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />} Submit Sales Intake
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
