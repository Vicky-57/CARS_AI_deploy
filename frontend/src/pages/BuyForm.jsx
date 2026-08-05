import { useState, useEffect } from 'react';
import { Car, CheckCircle, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { api } from '../api/api';

function Field({ label, de, type = 'text', required = false, placeholder = '', full = false, value, onChange }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <input id={id} className="form-input" type={type} required={required} placeholder={placeholder} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, de, required = false, options = [], full = false, value, onChange }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <select id={id} className="form-select" required={required} value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">— Please select / Bitte wählen —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
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
        <select className="form-select" style={{ width: 110, padding: '4px 8px', fontSize: '0.8rem' }} value={value?.billing ?? ''} onChange={e => onBillingChange(e.target.value)}>
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

const SERVICE_KEYS = ['kaufbegleitung', 'zulassung', 'hau', 'cert', 'transport', 'reinigung', 'detailing', 'vip', 'freikm', 'pflegeset', 'service', 'garantie', 'sorglos', 'repair', 'maintenance', 'care'];
const BUY_SERVICE_SLOTS = ['kaufbegleitung', 'zulassung', 'hau', 'cert', 'transport', 'reinigung', 'detailing', 'vip', 'freikm', 'pflegeset', 'service'];

function buildFieldData(form, services) {
  const data = { ...form };
  BUY_SERVICE_SLOTS.forEach((k, i) => {
    const s = services[k];
    if (s && s.price !== '') data[`price_${i + 1}`] = s.price;
  });
  if (services.repair?.price !== '') data.repair_price = services.repair?.price ?? '';
  if (services.maintenance?.price !== '') data.maintenance_price = services.maintenance?.price ?? '';
  if (services.care?.price !== '') data.care_price = services.care?.price ?? '';
  return data;
}

export default function BuyForm() {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', street: '', zip_city: '', id_card: '', salutation: '', id_consent: '',
    manufacturer: '', model: '', fuel: '', gearbox: '', first_date: '', max_km: '', power: '',
    displacement: '', tuev_until: '', owners: '', wanted_colors: '', other_req: '',
    must_haves: '', nice_haves: '', no_gos: '', accident_required: '', max_damage: '', commercial: '', reimport: '',
    max_price: '', final_price: '', collection: '', handover_location: '', payment: '', package: '', special_agreements: '',
    stored: '', storage_opt: '', place: '', date: '',
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
        template_type: 'buy_passiv',
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
    { n: 1, label: 'Personal / Persönliche Daten' },
    { n: 2, label: 'Search Profile / Suchprofil' },
    { n: 3, label: 'Requirements / Anforderungen' },
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
            Your search request has been saved. We will contact you shortly.
            <br />
            Ihre Suchanfrage wurde gespeichert. Wir melden uns in Kürze.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--gray-50, #f9fafb)', padding: '32px 16px', fontFamily: 'inherit',
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
            Buy Your Next Vehicle / Fahrzeugbeschaffung
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Tell us exactly what you are looking for and we will find and procure your vehicle.
            <br />
            Teilen Sie uns mit, wonach Sie suchen — wir beschaffen Ihr Fahrzeug.
          </p>
          <div className="badge badge-buy" style={{ marginTop: 10, padding: '4px 12px' }}>BUY / BESCHAFFUNG</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {steps.map(s => (
            <div key={s.n} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
              background: step === s.n ? 'var(--brand-600,#2563eb)' : 'var(--surface,#fff)',
              color: step === s.n ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.72rem', fontWeight: 600, border: step === s.n ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: step === s.n ? 'rgba(255,255,255,.25)' : 'var(--gray-100,#f3f4f6)', fontSize: '0.65rem',
              }}>{s.n}</span>
              {s.label}
            </div>
          ))}
        </div>

        <div className="card" style={{ border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', borderRadius: 16 }}>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', padding: 28 }}
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
                <SelectField label="Consent to ID copy (Anti-Money-Laundering Act)" de="Zustimmung Ausweiskopie (GwG)" full
                  options={['Ja / Yes', 'Nein / No']} value={form.id_consent} onChange={setF('id_consent')} />
              </>
            )}

            {/* STEP 2: Search Profile */}
            {step === 2 && (
              <>
                <SectionTitle num={2} en="Vehicle Search Profile" de="Fahrzeug-Suchprofil" />
                <Field label="Manufacturer" de="Hersteller" required placeholder="BMW, Audi, VW…" value={form.manufacturer} onChange={setF('manufacturer')} />
                <Field label="Model / Type" de="Modell/Typ" placeholder="A4 Avant" value={form.model} onChange={setF('model')} />
                <SelectField label="Fuel type" de="Kraftstoffart" options={['Benzin / Petrol', 'Diesel / Diesel', 'Elektro / Electric', 'Hybrid / Hybrid', 'Gas / LPG']} value={form.fuel} onChange={setF('fuel')} />
                <SelectField label="Gearbox" de="Getriebe" options={['Manuell / Manual', 'Automatik / Automatic', 'DSG / Double-clutch']} value={form.gearbox} onChange={setF('gearbox')} />
                <Field label="First registration from" de="Erstzulassung ab" type="date" value={form.first_date} onChange={setF('first_date')} />
                <Field label="Maximum mileage (km)" de="KM-Stand maximal" type="number" placeholder="80000" value={form.max_km} onChange={setF('max_km')} />
                <Field label="Minimum power (PS/kW)" de="Leistung mind. (PS/kW)" placeholder="150 PS" value={form.power} onChange={setF('power')} />
                <Field label="Displacement (ccm)" de="Hubraum (ccm)" type="number" placeholder="1995" value={form.displacement} onChange={setF('displacement')} />
                <Field label="HU/AU valid until (min)" de="HU/AU bis" type="date" value={form.tuev_until} onChange={setF('tuev_until')} />
                <Field label="Maximum number of owners" de="Anzahl Halter maximal" type="number" placeholder="3" value={form.owners} onChange={setF('owners')} />
                <Field label="Wanted color(s)" de="Wunschfarbe(n)" placeholder="Schwarz, Anthrazit" value={form.wanted_colors} onChange={setF('wanted_colors')} />
                <TextAreaField label="Other requirements" de="Sonstiges" placeholder="Anything else / Sonstige Wünsche" full value={form.other_req} onChange={setF('other_req')} />
              </>
            )}

            {/* STEP 3: Requirements */}
            {step === 3 && (
              <>
                <SectionTitle num={3} en="Requirements & Exclusions" de="Anforderungen & Ausschlüsse" />
                <TextAreaField label="Must-haves (mandatory equipment)" de="MUSS-Haben (Pflichtausstattung)" placeholder="Panoramadach, Sitzheizung…" full required value={form.must_haves} onChange={setF('must_haves')} />
                <TextAreaField label="Nice-to-haves (wish equipment)" de="NICE-TO-HAVES (Wunschausstattung)" placeholder="Head-up-Display, BOSE…" full value={form.nice_haves} onChange={setF('nice_haves')} />
                <TextAreaField label="No-gos (exclusion criteria)" de="NO-GOS (Ausschlusskriterien)" placeholder="Kein Unfallfahrzeug…" full value={form.no_gos} onChange={setF('no_gos')} />
                <SelectField label="Accident-free strictly required?" de="Unfallfreiheit zwingend erforderlich" full options={['Ja / Yes', 'Nein / No']} value={form.accident_required} onChange={setF('accident_required')} />
                <TextAreaField label="Maximum acceptable prior damage" de="Max. akzeptabler Umfang von Vorschäden" full value={form.max_damage} onChange={setF('max_damage')} />
                <SelectField label="Commercial use accepted?" de="Gewerbliche Nutzung akzeptiert" options={['Nein / No', 'Ja / Yes']} value={form.commercial} onChange={setF('commercial')} />
                <SelectField label="Re-import / EU vehicle accepted?" de="Re-Import/EU-Fahrzeug akzeptiert" options={['Nein / No', 'Ja / Yes']} value={form.reimport} onChange={setF('reimport')} />
              </>
            )}

            {/* STEP 4: Price & Package */}
            {step === 4 && (
              <>
                <SectionTitle num={4} en="Price & Service Package" de="Preis & Leistungspaket" />
                <Field label="Maximum purchase price (€)" de="Kaufpreisobergrenze (€)" required type="number" placeholder="25000" value={form.max_price} onChange={setF('max_price')} />
                <Field label="Final purchase price (€) — for Kaufvertrag" de="Kaufpreis (€)" type="number" placeholder="23800" value={form.final_price} onChange={setF('final_price')} />
                <SelectField label="Vehicle collection by" de="Abholung durch" full options={['CAR-AGENTS (broker) / Vermittler', 'Client / Auftraggeber']} value={form.collection} onChange={setF('collection')} />
                <Field label="Handover location" de="Ort der Übergabe" full placeholder="93349 Mindelstetten" value={form.handover_location} onChange={setF('handover_location')} />
                <SelectField label="Payment of purchase price" de="Zahlung des Kaufpreises" full options={[
                  'Direct by client / durch den Auftraggeber direkt',
                  'Via broker (escrow) / über den Vermittler (Fremdgeldverwaltung)',
                ]} value={form.payment} onChange={setF('payment')} />
                <SelectField label="Service package" de="Leistungspaket" required full options={[
                  'Essential – €347 (4 weeks / Wochen)',
                  'Advanced – €1,247 (8 weeks / Wochen)',
                  'Concierge – €2,497 (12 weeks / Wochen)',
                ]} value={form.package} onChange={setF('package')} />
                <Field label="Special agreements" de="Sondervereinbarungen" placeholder="Anything else agreed / Sonstige Absprachen" full value={form.special_agreements} onChange={setF('special_agreements')} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Additional services (optional) / Zusatzservices (optional)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <ServiceItem label="Purchase support" de="Kaufbegleitung" value={services.kaufbegleitung} onPriceChange={v => setServices(s => ({ ...s, kaufbegleitung: { ...s.kaufbegleitung, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, kaufbegleitung: { ...s.kaufbegleitung, billing: v } }))} />
                    <ServiceItem label="Registration service" de="Zulassungsservice" value={services.zulassung} onPriceChange={v => setServices(s => ({ ...s, zulassung: { ...s.zulassung, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, zulassung: { ...s.zulassung, billing: v } }))} />
                    <ServiceItem label="HU/AU renewal" de="HU/AU-Auffrischung" value={services.hau} onPriceChange={v => setServices(s => ({ ...s, hau: { ...s.hau, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, hau: { ...s.hau, billing: v } }))} />
                    <ServiceItem label="TÜV/DEKRA condition certificate" de="Zustandszertifikat" value={services.cert} onPriceChange={v => setServices(s => ({ ...s, cert: { ...s.cert, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, cert: { ...s.cert, billing: v } }))} />
                    <ServiceItem label="Vehicle transport" de="Überführungsservice" value={services.transport} onPriceChange={v => setServices(s => ({ ...s, transport: { ...s.transport, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, transport: { ...s.transport, billing: v } }))} />
                    <ServiceItem label="Vehicle cleaning" de="Fahrzeugreinigung" value={services.reinigung} onPriceChange={v => setServices(s => ({ ...s, reinigung: { ...s.reinigung, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, reinigung: { ...s.reinigung, billing: v } }))} />
                    <ServiceItem label="Detailing (incl. polish)" de="Fahrzeugaufbereitung" value={services.detailing} onPriceChange={v => setServices(s => ({ ...s, detailing: { ...s.detailing, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, detailing: { ...s.detailing, billing: v } }))} />
                    <ServiceItem label="VIP status & aftercare" de="VIP-Status & Nachbetreuung" value={services.vip} onPriceChange={v => setServices(s => ({ ...s, vip: { ...s.vip, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, vip: { ...s.vip, billing: v } }))} />
                    <ServiceItem label="Additional free mileage" de="Zusätzliche Freikilometer" value={services.freikm} onPriceChange={v => setServices(s => ({ ...s, freikm: { ...s.freikm, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, freikm: { ...s.freikm, billing: v } }))} />
                    <ServiceItem label="Special care set" de="Spezial-Pflegeset" value={services.pflegeset} onPriceChange={v => setServices(s => ({ ...s, pflegeset: { ...s.pflegeset, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, pflegeset: { ...s.pflegeset, billing: v } }))} />
                    <ServiceItem label="Service arrangement" de="Service-Vermittlung" value={services.service} onPriceChange={v => setServices(s => ({ ...s, service: { ...s.service, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, service: { ...s.service, billing: v } }))} />
                    <ServiceItem label="Used-car warranty" de="Gebrauchtwagengarantie" value={services.garantie} onPriceChange={v => setServices(s => ({ ...s, garantie: { ...s.garantie, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, garantie: { ...s.garantie, billing: v } }))} />
                    <ServiceItem label="Sorglos insurance package" de="Sorglos-Paket-Versicherung" value={services.sorglos} onPriceChange={v => setServices(s => ({ ...s, sorglos: { ...s.sorglos, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, sorglos: { ...s.sorglos, billing: v } }))} />
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
                <SectionTitle num={5} en="Handover & Contact Consent" de="Übergabe & Kontakteinwilligung" />
                <SelectField label="Will the vehicle be stored with CAR-AGENTS until handover?" de="Fahrzeug bis Übergabe beim Makler abgestellt?" required full
                  options={['Ja / Yes', 'Nein / No']} value={form.stored} onChange={setF('stored')} />
                <SelectField label="Storage / risk option" de="Verwahrungsoption" full options={[
                  'Option A – Own insurance / Eigene Versicherung',
                  'Option B – Sorglos package / Sorglos-Paket (paid)',
                  'Option C – Own risk without comprehensive cover / Eigenrisiko',
                ]} value={form.storage_opt} onChange={setF('storage_opt')} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Contact consent for follow-up offers (optional) / Kontakteinwilligung (optional)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <CheckItem label="Email / E-Mail" checked={form.consent_email} onChange={setF('consent_email')} />
                    <CheckItem label="Phone / Telefon" checked={form.consent_phone} onChange={setF('consent_phone')} />
                    <CheckItem label="WhatsApp" checked={form.consent_whatsapp} onChange={setF('consent_whatsapp')} />
                  </div>
                </div>
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