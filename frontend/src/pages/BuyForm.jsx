import { useState } from 'react';
import { Car, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

function Field({ label, de, type = 'text', required = false, placeholder = '', full = false }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <input id={id} className="form-input" type={type} required={required} placeholder={placeholder} />
    </div>
  );
}

function SelectField({ label, de, required = false, options = [], full = false }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <select id={id} className="form-select" required={required}>
        <option value="">— Please select / Bitte wählen —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextAreaField({ label, de, required = false, placeholder = '', full = false }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <textarea id={id} className="form-textarea" rows={3} required={required} placeholder={placeholder} />
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

function CheckItem({ label, de }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
      <input type="checkbox" />
      {label} <span style={{ color: 'var(--text-muted)' }}>[{de}]</span>
    </label>
  );
}

function ServiceItem({ label, de, priceType = 'number' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: 'var(--text-primary)', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
        <input type="checkbox" />
        {label} <span style={{ color: 'var(--text-muted)' }}>[{de}]</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Price [Preis]</span>
        <input type={priceType} className="form-input" style={{ width: 90, padding: '4px 8px', fontSize: '0.8rem' }} placeholder="€" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Billing [Abrechnung]</span>
        <select className="form-select" style={{ width: 110, padding: '4px 8px', fontSize: '0.8rem' }}>
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

export default function BuyForm() {
  const [step, setStep] = useState(1);

  const steps = [
    { n: 1, label: 'Personal / Persönliche Daten' },
    { n: 2, label: 'Search Profile / Suchprofil' },
    { n: 3, label: 'Requirements / Anforderungen' },
    { n: 4, label: 'Price & Package / Preis & Paket' },
    { n: 5, label: 'Handover / Übergabe' },
  ];

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
            onSubmit={e => { e.preventDefault(); alert('Form submitted! / Formular abgeschickt!'); }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', padding: 28 }}
          >
            {/* STEP 1: Personal */}
            {step === 1 && (
              <>
                <SectionTitle num={1} en="Personal Details" de="Persönliche Daten" />
                <SelectField label="Salutation" de="Anrede" required options={['Herr / Mr.', 'Frau / Mrs.', 'Divers / Other']} />
                <Field label="First & Last Name" de="Name, Vorname" required placeholder="Max Mustermann" />
                <Field label="Phone" de="Telefon" required type="tel" placeholder="+49 170 1234567" />
                <Field label="Email" de="E-Mail" required type="email" placeholder="max@example.de" />
                <Field label="Street, House No." de="Straße, Haus-Nr." required placeholder="Musterstraße 12" />
                <Field label="ZIP, City" de="PLZ, Ort" required placeholder="93349 Mindelstetten" />
                <Field label="ID Type / Number" de="Ausweis-Typ/Nr." placeholder="Personalausweis / 123456789" />
                <SelectField label="Consent to ID copy (Anti-Money-Laundering Act)" de="Zustimmung Ausweiskopie (GwG)" full
                  options={['Ja / Yes', 'Nein / No']} />
              </>
            )}

            {/* STEP 2: Search Profile */}
            {step === 2 && (
              <>
                <SectionTitle num={2} en="Vehicle Search Profile" de="Fahrzeug-Suchprofil" />
                <Field label="Manufacturer" de="Hersteller" required placeholder="BMW, Audi, VW…" />
                <Field label="Model / Type" de="Modell/Typ" placeholder="A4 Avant" />
                <SelectField label="Fuel type" de="Kraftstoffart" options={['Benzin / Petrol', 'Diesel / Diesel', 'Elektro / Electric', 'Hybrid / Hybrid', 'Gas / LPG']} />
                <SelectField label="Gearbox" de="Getriebe" options={['Manuell / Manual', 'Automatik / Automatic', 'DSG / Double-clutch']} />
                <Field label="First registration from" de="Erstzulassung ab" type="date" />
                <Field label="Maximum mileage (km)" de="KM-Stand maximal" type="number" placeholder="80000" />
                <Field label="Minimum power (PS/kW)" de="Leistung mind. (PS/kW)" placeholder="150 PS" />
                <Field label="Displacement (ccm)" de="Hubraum (ccm)" type="number" placeholder="1995" />
                <Field label="HU/AU valid until (min)" de="HU/AU bis" type="date" />
                <Field label="Maximum number of owners" de="Anzahl Halter maximal" type="number" placeholder="3" />
                <Field label="Wanted color(s)" de="Wunschfarbe(n)" placeholder="Schwarz, Anthrazit" />
                <TextAreaField label="Other requirements" de="Sonstiges" placeholder="Anything else / Sonstige Wünsche" full />
              </>
            )}

            {/* STEP 3: Requirements */}
            {step === 3 && (
              <>
                <SectionTitle num={3} en="Requirements & Exclusions" de="Anforderungen & Ausschlüsse" />
                <TextAreaField label="Must-haves (mandatory equipment)" de="MUSS-Haben (Pflichtausstattung)" placeholder="Panoramadach, Sitzheizung…" full required />
                <TextAreaField label="Nice-to-haves (wish equipment)" de="NICE-TO-HAVES (Wunschausstattung)" placeholder="Head-up-Display, BOSE…" full />
                <TextAreaField label="No-gos (exclusion criteria)" de="NO-GOS (Ausschlusskriterien)" placeholder="Kein Unfallfahrzeug…" full />
                <SelectField label="Accident-free strictly required?" de="Unfallfreiheit zwingend erforderlich" full options={['Ja / Yes', 'Nein / No']} />
                <TextAreaField label="Maximum acceptable prior damage" de="Max. akzeptabler Umfang von Vorschäden" full />
                <SelectField label="Commercial use accepted?" de="Gewerbliche Nutzung akzeptiert" options={['Nein / No', 'Ja / Yes']} />
                <SelectField label="Re-import / EU vehicle accepted?" de="Re-Import/EU-Fahrzeug akzeptiert" options={['Nein / No', 'Ja / Yes']} />
              </>
            )}

            {/* STEP 4: Price & Package */}
            {step === 4 && (
              <>
                <SectionTitle num={4} en="Price & Service Package" de="Preis & Leistungspaket" />
                <Field label="Maximum purchase price (€)" de="Kaufpreisobergrenze (€)" required type="number" placeholder="25000" />
                <Field label="Final purchase price (€) — for Kaufvertrag" de="Kaufpreis (€)" type="number" placeholder="23800" />
                <SelectField label="Vehicle collection by" de="Abholung durch" full options={['CAR-AGENTS (broker) / Vermittler', 'Client / Auftraggeber']} />
                <Field label="Handover location" de="Ort der Übergabe" full placeholder="93349 Mindelstetten" />
                <SelectField label="Payment of purchase price" de="Zahlung des Kaufpreises" full options={[
                  'Direct by client / durch den Auftraggeber direkt',
                  'Via broker (escrow) / über den Vermittler (Fremdgeldverwaltung)',
                ]} />
                <SelectField label="Service package" de="Leistungspaket" required full options={[
                  'Essential – €347 (4 weeks / Wochen)',
                  'Advanced – €1,247 (8 weeks / Wochen)',
                  'Concierge – €2,497 (12 weeks / Wochen)',
                ]} />
                <Field label="Special agreements" de="Sondervereinbarungen" placeholder="Anything else agreed / Sonstige Absprachen" full />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Additional services (optional) / Zusatzservices (optional)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <ServiceItem label="Purchase support" de="Kaufbegleitung" />
                    <ServiceItem label="Registration service" de="Zulassungsservice" />
                    <ServiceItem label="HU/AU renewal" de="HU/AU-Auffrischung" />
                    <ServiceItem label="TÜV/DEKRA condition certificate" de="Zustandszertifikat" />
                    <ServiceItem label="Vehicle transport" de="Überführungsservice" />
                    <ServiceItem label="Vehicle cleaning" de="Fahrzeugreinigung" />
                    <ServiceItem label="Detailing (incl. polish)" de="Fahrzeugaufbereitung" />
                    <ServiceItem label="VIP status & aftercare" de="VIP-Status & Nachbetreuung" />
                    <ServiceItem label="Additional free mileage" de="Zusätzliche Freikilometer" />
                    <ServiceItem label="Special care set" de="Spezial-Pflegeset" />
                    <ServiceItem label="Service arrangement" de="Service-Vermittlung" />
                    <ServiceItem label="Used-car warranty" de="Gebrauchtwagengarantie" />
                    <ServiceItem label="Sorglos insurance package" de="Sorglos-Paket-Versicherung" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10, marginTop: 10 }}>
                    <ServiceItem label="External: Repair work" de="Instandsetzung" />
                    <ServiceItem label="External: Maintenance" de="Instandhaltung" />
                    <ServiceItem label="External: Care / other" de="Pflege/Sonstiges" />
                  </div>
                </div>
              </>
            )}

            {/* STEP 5: Handover */}
            {step === 5 && (
              <>
                <SectionTitle num={5} en="Handover & Contact Consent" de="Übergabe & Kontakteinwilligung" />
                <SelectField label="Will the vehicle be stored with CAR-AGENTS until handover?" de="Fahrzeug bis Übergabe beim Makler abgestellt?" required full
                  options={['Ja / Yes', 'Nein / No']} />
                <SelectField label="Storage / risk option" de="Verwahrungsoption" full options={[
                  'Option A – Own insurance / Eigene Versicherung',
                  'Option B – Sorglos package / Sorglos-Paket (paid)',
                  'Option C – Own risk without comprehensive cover / Eigenrisiko',
                ]} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Contact consent for follow-up offers (optional) / Kontakteinwilligung (optional)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <CheckItem label="Email / E-Mail" />
                    <CheckItem label="Phone / Telefon" />
                    <CheckItem label="WhatsApp" />
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <input type="checkbox" required />
                    <span>
                      I confirm that the information provided is complete and correct, and I have read the Terms &amp; Conditions, Fairplay Check and revocation notice.
                      <br />
                      <span style={{ color: 'var(--text-muted)' }}>Ich bestätige, dass die Angaben vollständig und korrekt sind und ich AGB, Fairplay-Check und Widerrufsbelehrung erhalten habe.</span>
                    </span>
                  </label>
                </div>
                <Field label="Place" de="Ort" placeholder="Mindelstetten" />
                <Field label="Date" de="Datum" type="date" required />
              </>
            )}

            {/* Footer */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
                <ChevronLeft size={15} /> Back / Zurück
              </button>
              {step < 5 ? (
                <button type="button" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setStep(step + 1)}>
                  Next / Weiter <ChevronRight size={15} />
                </button>
              ) : (
                <button type="submit" className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={15} /> Submit / Absenden
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
