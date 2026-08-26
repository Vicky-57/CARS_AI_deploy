import { useState, useEffect } from 'react';
import { Car, CheckCircle, ChevronLeft, ChevronRight, Loader, ChevronDown } from 'lucide-react';
import { api } from '../api/api';

const SECTION_LABEL = (en, de) => ({ en, de });

function Field({ label, de, type = 'text', required = false, placeholder = '', full = false, value, onChange, disabled = false }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: 'var(--danger, #dc2626)' }}> *</span>}
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
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <select 
          id={id} 
          className="form-select" 
          required={required} 
          value={value ?? ''} 
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{ 
            appearance: 'none', WebkitAppearance: 'none',
            paddingRight: 36, cursor: 'pointer', width: '100%',
            borderColor: '#e2e8f0', background: '#ffffff', color: '#0f172a'
          }}
        >
          <option value="">— Please select / Bitte wählen —</option>
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#ea580c' }}>
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
}

function TextAreaField({ label, de, required = false, placeholder = '', full = false, value, onChange }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <textarea id={id} className="form-textarea" rows={3} required={required} placeholder={placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SectionTitle({ num, en, de }) {
  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 2, color: 'var(--brand-700, #1d4ed8)' }}>
        {num}. {en} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>[{de}]</span>
      </h2>
      <div style={{ height: 2, background: 'var(--brand-100, #dbeafe)', borderRadius: 2, marginBottom: 20 }} />
    </div>
  );
}

function CheckItem({ label, de, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      {label} <span style={{ color: 'var(--text-muted)' }}>[{de}]</span>
    </label>
  );
}

function ServiceItem({ label, de, priceType = 'number', value, onPriceChange, onBillingChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: 'var(--text-primary)', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
        <input type="checkbox" checked={!!(value && value.price)} onChange={e => onPriceChange(e.target.checked ? '0' : '')} />
        {label} <span style={{ color: 'var(--text-muted)' }}>[{de}]</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Price [Preis]</span>
        <input type={priceType} className="form-input" style={{ width: 90, padding: '4px 8px', fontSize: '0.8rem' }} placeholder="€" value={value?.price ?? ''} onChange={e => onPriceChange(e.target.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Billing [Abrechnung]</span>
        <div style={{ position: 'relative' }}>
          <select 
            className="form-select" 
            style={{ width: 110, padding: '4px 28px 4px 8px', fontSize: '0.8rem', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }} 
            value={value?.billing ?? ''} 
            onChange={e => onBillingChange(e.target.value)}
          >
            <option value="">—</option>
            <option>VK</option>
            <option>VR</option>
            <option>INCL</option>
            <option>SZ</option>
          </select>
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#ea580c' }}>
            <ChevronDown size={14} />
          </div>
        </div>
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

  // Load session from ?token=
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

  // Persist current step to backend
  const saveStep = async (nextStep) => {
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
    const ok = await saveStep(step + 1);
    if (ok) setStep(s => Math.min(5, s + 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await saveStep(5);
    if (ok) {
      setSaved(true);
    }
  };

  const steps = [
    { n: 1, label: 'Personal Details / Persönliche Daten' },
    { n: 2, label: 'Vehicle / Fahrzeug' },
    { n: 3, label: 'Condition / Zustand' },
    { n: 4, label: 'Price & Package / Preis & Paket' },
    { n: 5, label: 'Handover / Übergabe' },
  ];

  if (saved) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50,#f9fafb)', padding: 32 }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', borderRadius: 16 }}>
          <CheckCircle size={48} color="var(--success,#16a34a)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem' }}>Thank you! / Vielen Dank!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Your information has been saved. We will contact you shortly.
            <br />
            Ihre Angaben wurden gespeichert. Wir melden uns in Kürze.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-form-page" style={{
      minHeight: '100vh', background: 'var(--gray-50, #f9fafb)', padding: '32px 16px',
      fontFamily: 'inherit',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, var(--brand-600,#2563eb), var(--brand-700,#1d4ed8))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}>
            <Car size={28} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Sell Your Vehicle / Fahrzeugverkauf
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Complete the form and we will handle the sale of your vehicle.
            <br />
            Bitte füllen Sie das Formular aus — wir übernehmen den Verkauf Ihres Fahrzeugs.
          </p>
          <div className="badge badge-sell" style={{ marginTop: 10, padding: '4px 12px' }}>SELL / VERKAUF</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, position: 'relative', maxWidth: 640, margin: '0 auto 40px' }}>
          {/* Connecting line */}
          <div style={{ position: 'absolute', top: 20, left: '10%', right: '10%', height: 2, background: '#e2e8f0', zIndex: 0 }}></div>
          
          {steps.map((s) => (
            <div key={s.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step === s.n ? '#ba5d39' : '#ffffff',
                color: step === s.n ? '#ffffff' : '#64748b',
                border: step === s.n ? 'none' : '3px solid #e2e8f0',
                fontSize: '0.9rem', fontWeight: 800, marginBottom: 12,
                boxShadow: step === s.n ? '0 4px 12px rgba(186, 93, 57, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                0{s.n}
              </div>
              <div style={{
                fontSize: '0.65rem',
                fontWeight: step === s.n ? 800 : 700,
                color: step === s.n ? '#0f172a' : '#94a3b8',
                textTransform: 'uppercase',
                textAlign: 'center',
                lineHeight: 1.4,
                letterSpacing: '0.5px',
                padding: '0 4px'
              }}>
                {s.label.split(' / ')[0]}
                <br />
                <span style={{ fontSize: '0.55rem', opacity: step === s.n ? 0.7 : 0.5, fontWeight: 600 }}>{s.label.split(' / ')[1]}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', borderRadius: 16 }}>
          <form
            onSubmit={handleSubmit}
            className="grid-2"
            style={{ gap: '4px 20px', padding: 28 }}
          >
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
                <Field label="Registration Cert. Part II No." de="Nr. Zulassungsbescheinigung Teil II" placeholder="ABC1234" value={form.zb2} onChange={setF('zb2')} />
                <Field label="Gas System Test until" de="Gasanlagenprüfung bis" type="date" value={form.gas_until} onChange={setF('gas_until')} />
                <Field label="Number of Keys" de="Anzahl Schlüssel" type="number" placeholder="2" value={form.keys} onChange={setF('keys')} />
              </>
            )}

            {/* STEP 3: Condition */}
            {step === 3 && (
              <>
                <SectionTitle num={3} en="Vehicle Condition & Declarations" de="Fahrzeugzustand & Erklärungen" />
                <SelectField label="Accident-free?" de="Unfallfreiheit" required options={['Ja / Yes', 'Nein / No']} value={form.accident_free} onChange={setF('accident_free')} />
                <Field label="If accident: type/extent" de="Art/Umfang von Unfallschäden" placeholder="Frontschaden, Reparatur 2023" full value={form.accident_details} onChange={setF('accident_details')} />
                <SelectField label="Still has first engine?" de="Erster Motor" options={['Ja / Yes', 'Nein / No']} value={form.first_engine} onChange={setF('first_engine')} />
                <Field label="Engine number" de="Motor-Nr." placeholder="WBA3A51050E123456" value={form.engine_number} onChange={setF('engine_number')} />
                <Field label="Replacement engine mileage (km)" de="KM-Stand Tauschmotor" type="number" placeholder="82000" value={form.engine_mileage} onChange={setF('engine_mileage')} />
                <Field label="Replacement engine install date" de="Einbaudatum" type="date" value={form.engine_date} onChange={setF('engine_date')} />
                <SelectField label="Commercial use?" de="Gewerbliche Nutzung" options={['Nein / No', 'Ja / Yes']} value={form.commercial} onChange={setF('commercial')} />
                <SelectField label="Re-import vehicle?" de="Re-Import" options={['Nein / No', 'Ja / Yes']} value={form.reimport} onChange={setF('reimport')} />
                <Field label="Origin country (if re-import)" de="Herkunftsland" placeholder="Niederlande" value={form.origin} onChange={setF('origin')} />
                <SelectField label="Ownership" de="Eigentumsverhältnisse" options={['Alleiniges Eigentum / Sole property', 'Belastet mit Rechten Dritter / Encumbered']} value={form.ownership} onChange={setF('ownership')} />
                <Field label="Details of third-party rights" de="Details Rechte Dritter" placeholder="Offener Kredit" full value={form.third_party} onChange={setF('third_party')} />
                <TextAreaField label="Known defects / prior damage" de="Bekannte Mängel/Vorschäden" placeholder="Describe any known defects / Bitte Mängel beschreiben" full value={form.defects} onChange={setF('defects')} />
                <TextAreaField label="Special equipment & accessories" de="Sonderausstattung & Zubehör" placeholder="AHK, Anhängerkupplung, Ledersitze…" full value={form.special_equipment} onChange={setF('special_equipment')} />
                <SelectField label="Mounted tires" de="Montierte Bereifung" options={['Sommer / Summer', 'Winter / Winter', 'Allwetter / All-season']} value={form.tires} onChange={setF('tires')} />
                <SelectField label="Tire profile" de="Reifenprofil" options={['Neu / New', 'Gut / Good', 'Brauchbar / Usable', 'Verschlissen / Worn']} value={form.tire_profile} onChange={setF('tire_profile')} />
                <SelectField label="Additional wheelset" de="Zusätzlicher Radsatz" options={['Keiner / None', 'Sommer / Summer', 'Winter / Winter', 'Allwetter / All-season']} value={form.wheelset} onChange={setF('wheelset')} />
                <SelectField label="Spare wheel" de="Reserverad" options={['Ja / Yes', 'Nein / No']} value={form.spare} onChange={setF('spare')} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tread depth (mm) [Profiltiefe (mm)] — for Kaufvertrag</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <Field label="Front left / VL" de="Profiltiefe" type="number" placeholder="mm" value={form.tread_vl} onChange={setF('tread_vl')} />
                    <Field label="Front right / VR" de="Profiltiefe" type="number" placeholder="mm" value={form.tread_vr} onChange={setF('tread_vr')} />
                    <Field label="Rear left / HL" de="Profiltiefe" type="number" placeholder="mm" value={form.tread_hl} onChange={setF('tread_hl')} />
                    <Field label="Rear right / HR" de="Profiltiefe" type="number" placeholder="mm" value={form.tread_hr} onChange={setF('tread_hr')} />
                  </div>
                </div>
              </>
            )}

            {/* STEP 4: Price & Package */}
            {step === 4 && (
              <>
                <SectionTitle num={4} en="Price & Service Package" de="Preis & Leistungspaket" />
                <Field label="Minimum sale price (€)" de="Mindestverkaufspreis (€)" required type="number" placeholder="15000" value={form.min_price} onChange={setF('min_price')} />
                <Field label="Final purchase price (€) — for Kaufvertrag" de="Kaufpreis (€)" required type="number" placeholder="16200" value={form.final_price} onChange={setF('final_price')} />
                <SelectField label="Service package" de="Leistungspaket" required full options={[
                  'Essential – €347 (4 weeks / Wochen)',
                  'Advanced – €1,247 (8 weeks / Wochen)',
                  'Concierge – €2,497 (12 weeks / Wochen)',
                ]} value={form.package} onChange={setF('package')} />
                <Field label="Special agreements" de="Sondervereinbarungen" placeholder="Anything else agreed / Sonstige Absprachen" full value={form.special_agreements} onChange={setF('special_agreements')} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Additional services (optional) / Zusatzservices (optional)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <ServiceItem label="Vehicle detailing" de="Fahrzeugaufbereitung" value={services.detailing} onPriceChange={v => setServices(s => ({ ...s, detailing: { ...s.detailing, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, detailing: { ...s.detailing, billing: v } }))} />
                    <ServiceItem label="Extra cleaning" de="Zusätzliche Reinigung" value={services.cleaning} onPriceChange={v => setServices(s => ({ ...s, cleaning: { ...s.cleaning, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, cleaning: { ...s.cleaning, billing: v } }))} />
                    <ServiceItem label="HU/AU renewal" de="HU/AU-Auffrischung" value={services.hau} onPriceChange={v => setServices(s => ({ ...s, hau: { ...s.hau, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, hau: { ...s.hau, billing: v } }))} />
                    <ServiceItem label="TÜV/DEKRA condition certificate" de="Zustandszertifikat" value={services.cert} onPriceChange={v => setServices(s => ({ ...s, cert: { ...s.cert, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, cert: { ...s.cert, billing: v } }))} />
                    <ServiceItem label="Appraisal / valuation" de="Wert-/Zustandsgutachten" value={services.appraisal} onPriceChange={v => setServices(s => ({ ...s, appraisal: { ...s.appraisal, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, appraisal: { ...s.appraisal, billing: v } }))} />
                    <ServiceItem label="Service arrangement" de="Service-Vermittlung" value={services.service} onPriceChange={v => setServices(s => ({ ...s, service: { ...s.service, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, service: { ...s.service, billing: v } }))} />
                    <ServiceItem label="Pickup & delivery" de="Hol- und Bringservice" value={services.pickup} onPriceChange={v => setServices(s => ({ ...s, pickup: { ...s.pickup, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, pickup: { ...s.pickup, billing: v } }))} />
                    <ServiceItem label="Vehicle transport" de="Überführungsservice" value={services.transport} onPriceChange={v => setServices(s => ({ ...s, transport: { ...s.transport, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, transport: { ...s.transport, billing: v } }))} />
                    <ServiceItem label="Marketing boost" de="Marketing-Boost" value={services.marketing} onPriceChange={v => setServices(s => ({ ...s, marketing: { ...s.marketing, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, marketing: { ...s.marketing, billing: v } }))} />
                    <ServiceItem label="Sorglos insurance package" de="Sorglos-Paket-Versicherung" value={services.sorglos} onPriceChange={v => setServices(s => ({ ...s, sorglos: { ...s.sorglos, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, sorglos: { ...s.sorglos, billing: v } }))} />
                    <ServiceItem label="Storage fees" de="Standgeldgebühren" value={services.storage} onPriceChange={v => setServices(s => ({ ...s, storage: { ...s.storage, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, storage: { ...s.storage, billing: v } }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10, marginTop: 10 }}>
                    <ServiceItem label="External: Repair work" de="Instandsetzung" value={services.repair} onPriceChange={v => setServices(s => ({ ...s, repair: { ...s.repair, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, repair: { ...s.repair, billing: v } }))} />
                    <ServiceItem label="External: Maintenance" de="Instandhaltung" value={services.maintenance} onPriceChange={v => setServices(s => ({ ...s, maintenance: { ...s.maintenance, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, maintenance: { ...s.maintenance, billing: v } }))} />
                    <ServiceItem label="External: Care / other" de="Pflege/Sonstiges" value={services.care} onPriceChange={v => setServices(s => ({ ...s, care: { ...s.care, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, care: { ...s.care, billing: v } }))} />
                  </div>
                </div>
              </>
            )}

            {/* STEP 5: Handover */}
            {step === 5 && (
              <>
                <SectionTitle num={5} en="Handover & Documents" de="Übergabe & Dokumente" />
                <SelectField label="Will the vehicle be stored with CAR-AGENTS during marketing?" de="Fahrzeug beim Makler abgestellt?" required full
                  options={['Ja / Yes', 'Nein / No']} value={form.stored} onChange={setF('stored')} />
                <SelectField label="Storage / risk option" de="Verwahrungsoption" full options={[
                  'Option A – Own insurance / Eigene Versicherung',
                  'Option B – Sorglos package / Sorglos-Paket (paid)',
                  'Option C – Own risk without comprehensive cover / Eigenrisiko',
                ]} value={form.storage_opt} onChange={setF('storage_opt')} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Documents handed over / Übergebene Unterlagen</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <CheckItem label="Registration Certificate Part I" de="Zulassungsbescheinigung Teil I" checked={form.doc_zb1} onChange={setF('doc_zb1')} />
                    <CheckItem label="Registration Certificate Part II" de="Zulassungsbescheinigung Teil II" checked={form.doc_zb2} onChange={setF('doc_zb2')} />
                    <CheckItem label="COC paper" de="COC-Papier" checked={form.doc_coc} onChange={setF('doc_coc')} />
                    <CheckItem label="Service booklet" de="Serviceheft" checked={form.doc_service} onChange={setF('doc_service')} />
                  </div>
                </div>
                <Field label="Number of keys handed over" de="Anzahl übergebener Schlüssel" type="number" placeholder="2" value={form.keys_handed} onChange={setF('keys_handed')} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <input type="checkbox" required checked={!!form.consent} onChange={e => setF('consent')(e.target.checked)} />
                    <span>
                      I confirm that the information provided is complete and correct, and I have read the Terms &amp; Conditions, Fairplay Check and revocation notice.
                      <br />
                      <span style={{ color: 'var(--text-muted)' }}>Ich bestätige, dass die Angaben vollständig und korrekt sind und ich AGB, Fairplay-Check und Widerrufsbelehrung erhalten habe.</span>
                    </span>
                  </label>
                </div>
                <Field label="Place" de="Ort" placeholder="Mindelstetten" value={form.place} onChange={setF('place')} />
                <Field label="Date" de="Datum" type="date" required value={form.date} onChange={setF('date')} />
              </>
            )}

            {/* Footer */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || saving}>
                <ChevronLeft size={15} /> Back / Zurück
              </button>
              {step < 5 ? (
                <button type="button" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={goNext} disabled={saving}>
                  {saving ? <Loader size={15} className="spin" /> : <ChevronRight size={15} />} Next / Weiter
                </button>
              ) : (
                <button type="submit" className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
                  {saving ? <Loader size={15} className="spin" /> : <CheckCircle size={15} />} Submit / Absenden
                </button>
              )}
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 20 }}>
          CAR-AGENTS · Inhaber: Maxim Lorenz · Lerchenweg 7, 93349 Mindelstetten · info@car-agents.de
        </p>
      </div>
    </div>
  );
}
