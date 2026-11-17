import { useState, useEffect } from 'react';
import { Car, CheckCircle, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { api } from '../api/api';
import FormStepper from '../components/FormStepper';

function Field({ label, de, type = 'text', required = false, placeholder = '', full = false, value, onChange }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: 'var(--danger)' }}> *</span>}
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
        {required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <select 
        id={id} 
        className="form-select" 
        required={required} 
        value={value ?? ''} 
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
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
    { n: 1, label: 'Personal Data', de: 'Persönliche Daten' },
    { n: 2, label: 'Search Profile', de: 'Suchprofil' },
    { n: 3, label: 'Requirements', de: 'Anforderungen' },
    { n: 4, label: 'Price & Package', de: 'Preis & Paket' },
    { n: 5, label: 'Mandate', de: 'Bestätigung' },
  ];

  if (saved) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)', padding: 32 }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '40px 32px' }}>
          <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700 }}>Thank you! / Vielen Dank!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Your search request has been saved. Our broker team will contact you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="intake-page-wrapper">
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
            Vehicle Procurement / Suchauftrag
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Specify your vehicle requirements and preferences for broker acquisition
          </p>
        </div>

        {/* Step Progress Bar */}
        <FormStepper steps={steps} currentStep={step} onStepChange={setStep} />

        {/* Card Form */}
        <div className="card intake-form-card">
          <form onSubmit={handleSubmit} className="intake-form-grid">
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
                <SelectField label="Consent to ID copy (GwG)" de="Zustimmung Ausweiskopie" full options={['Ja / Yes', 'Nein / No']} value={form.id_consent} onChange={setF('id_consent')} />
              </>
            )}

            {/* STEP 2: Search Profile */}
            {step === 2 && (
              <>
                <SectionTitle num={2} en="Search Profile & Criteria" de="Suchprofil & Kriterien" />
                <Field label="Manufacturer" de="Hersteller" placeholder="e.g. BMW, Porsche" value={form.manufacturer} onChange={setF('manufacturer')} />
                <Field label="Model" de="Modell" placeholder="e.g. 911 GT3, M3" value={form.model} onChange={setF('model')} />
                <SelectField label="Fuel Type" de="Kraftstoffart" options={['Benzin / Petrol', 'Diesel', 'Hybrid', 'Elektro / EV']} value={form.fuel} onChange={setF('fuel')} />
                <SelectField label="Gearbox" de="Getriebe" options={['Automatik / Automatic', 'Handschaltung / Manual']} value={form.gearbox} onChange={setF('gearbox')} />
                <Field label="First Registration (from)" de="Erstzulassung (ab)" placeholder="YYYY or MM/YYYY" value={form.first_date} onChange={setF('first_date')} />
                <Field label="Max Mileage (km)" de="Max. Kilometerstand" type="number" placeholder="50000" value={form.max_km} onChange={setF('max_km')} />
                <Field label="Min Power (kW/PS)" de="Min. Leistung" placeholder="300 kW / 408 PS" value={form.power} onChange={setF('power')} />
                <Field label="Wanted Colors" de="Wunschfarben" placeholder="Schwarz, Grau, Blau" value={form.wanted_colors} onChange={setF('wanted_colors')} />
              </>
            )}

            {/* STEP 3: Requirements */}
            {step === 3 && (
              <>
                <SectionTitle num={3} en="Vehicle Requirements" de="Fahrzeuganforderungen" />
                <TextAreaField label="Must-Haves (Essential features)" de="Must-Haves" placeholder="Panoramadach, Sportabgasanlage, etc." full value={form.must_haves} onChange={setF('must_haves')} />
                <TextAreaField label="Nice-to-Haves (Optional features)" de="Nice-to-Haves" placeholder="Head-up Display, Standheizung" full value={form.nice_haves} onChange={setF('nice_haves')} />
                <TextAreaField label="No-Gos (Excluded items)" de="Ausschlusskriterien" placeholder="Raucherfahrzeug, Reimport" full value={form.no_gos} onChange={setF('no_gos')} />
              </>
            )}

            {/* STEP 4: Price & Package */}
            {step === 4 && (
              <>
                <SectionTitle num={4} en="Price & Service Package" de="Preis & Leistungspaket" />
                <Field label="Max Budget (€)" de="Max. Budget" type="number" required placeholder="65000" value={form.max_price} onChange={setF('max_price')} />
                <SelectField label="Service Package" de="Leistungspaket" required options={[
                  'Essential – €347 (4 weeks)',
                  'Advanced – €1,247 (8 weeks)',
                  'Concierge – €2,497 (12 weeks)',
                ]} value={form.package} onChange={setF('package')} />
                <Field label="Handover Location" de="Ort der Übergabe" full placeholder="93349 Mindelstetten" value={form.handover_location} onChange={setF('handover_location')} />
                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Additional Services / Zusatzservices:</div>
                  <ServiceItem label="Purchase support" de="Kaufbegleitung" value={services.kaufbegleitung} onPriceChange={v => setServices(s => ({ ...s, kaufbegleitung: { ...s.kaufbegleitung, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, kaufbegleitung: { ...s.kaufbegleitung, billing: v } }))} />
                  <ServiceItem label="Registration service" de="Zulassungsservice" value={services.zulassung} onPriceChange={v => setServices(s => ({ ...s, zulassung: { ...s.zulassung, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, zulassung: { ...s.zulassung, billing: v } }))} />
                  <ServiceItem label="HU/AU renewal" de="HU/AU-Auffrischung" value={services.hau} onPriceChange={v => setServices(s => ({ ...s, hau: { ...s.hau, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, hau: { ...s.hau, billing: v } }))} />
                  <ServiceItem label="Vehicle transport" de="Überführungsservice" value={services.transport} onPriceChange={v => setServices(s => ({ ...s, transport: { ...s.transport, price: v } }))} onBillingChange={v => setServices(s => ({ ...s, transport: { ...s.transport, billing: v } }))} />
                </div>
              </>
            )}

            {/* STEP 5: Handover */}
            {step === 5 && (
              <>
                <SectionTitle num={5} en="Handover & Consent" de="Übergabe & Bestätigung" />
                <SelectField label="Store vehicle with broker until handover?" de="Fahrzeug beim Makler abgestellt?" required full
                  options={['Ja / Yes', 'Nein / No']} value={form.stored} onChange={setF('stored')} />
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
                  {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />} Submit Search Order
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}