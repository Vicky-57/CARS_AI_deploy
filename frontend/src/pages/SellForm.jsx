import { useState } from 'react';
import { Car, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const SECTION_LABEL = (en, de) => ({ en, de });

function Field({ label, de, type = 'text', required = false, placeholder = '', full = false, children }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: 'var(--danger, #dc2626)' }}> *</span>}
      </label>
      {children ? (
        children
      ) : (
        <input id={id} className="form-input" type={type} required={required} placeholder={placeholder} />
      )}
    </div>
  );
}

function SelectField({ label, de, required = false, options = [] }) {
  const id = (label + de).replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>[{de}]</span>
        {required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <select id={id} className="form-select" required={required}>
        <option value="">— Please select / Bitte wählen —</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
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

export default function SellForm() {
  const [step, setStep] = useState(1);

  const steps = [
    { n: 1, label: 'Personal Details / Persönliche Daten' },
    { n: 2, label: 'Vehicle / Fahrzeug' },
    { n: 3, label: 'Condition / Zustand' },
    { n: 4, label: 'Price & Package / Preis & Paket' },
    { n: 5, label: 'Handover / Übergabe' },
  ];

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
              </>
            )}

            {/* STEP 2: Vehicle */}
            {step === 2 && (
              <>
                <SectionTitle num={2} en="Vehicle Details" de="Fahrzeugdaten" />
                <Field label="Manufacturer" de="Hersteller" required placeholder="BMW, Audi, VW…" />
                <Field label="Model / Type" de="Modell/Typ" required placeholder="320d xDrive" />
                <Field label="VIN (17 digits)" de="Fahrzeug-Ident.-Nr. (FIN)" required placeholder="WBA3A51050E123456" />
                <Field label="License Plate" de="Amtl. Kennzeichen" placeholder="EI-TX 420" />
                <Field label="First Registration" de="Datum der Erstzulassung" type="date" />
                <Field label="Mileage (km)" de="Kilometerstand" required type="number" placeholder="75000" />
                <Field label="Power (PS/kW)" de="Leistung (PS/kW)" placeholder="184 PS / 135 kW" />
                <Field label="Displacement (ccm)" de="Hubraum (ccm)" type="number" placeholder="1995" />
                <Field label="HU/AU valid until" de="HU/AU gültig bis" type="date" />
                <Field label="Number of Owners" de="Anzahl Halter" type="number" placeholder="2" />
                <Field label="Color / Paint" de="Farbe / Lackart" placeholder="Schwarz / Uni" />
                <Field label="Registration Cert. Part II No." de="Nr. Zulassungsbescheinigung Teil II" placeholder="ABC1234" />
                <Field label="Gas System Test until" de="Gasanlagenprüfung bis" type="date" />
                <Field label="Number of Keys" de="Anzahl Schlüssel" type="number" placeholder="2" />
              </>
            )}

            {/* STEP 3: Condition */}
            {step === 3 && (
              <>
                <SectionTitle num={3} en="Vehicle Condition & Declarations" de="Fahrzeugzustand & Erklärungen" />
                <SelectField label="Accident-free?" de="Unfallfreiheit" required options={['Ja / Yes', 'Nein / No']} />
                <Field label="If accident: type/extent" de="Art/Umfang von Unfallschäden" placeholder="Frontschaden, Reparatur 2023" full />
                <SelectField label="Still has first engine?" de="Erster Motor" options={['Ja / Yes', 'Nein / No']} />
                <Field label="Engine number" de="Motor-Nr." placeholder="WBA3A51050E123456" />
                <Field label="Replacement engine mileage (km)" de="KM-Stand Tauschmotor" type="number" placeholder="82000" />
                <Field label="Replacement engine install date" de="Einbaudatum" type="date" />
                <SelectField label="Commercial use?" de="Gewerbliche Nutzung" options={['Nein / No', 'Ja / Yes']} />
                <SelectField label="Re-import vehicle?" de="Re-Import" options={['Nein / No', 'Ja / Yes']} />
                <Field label="Origin country (if re-import)" de="Herkunftsland" placeholder="Niederlande" />
                <SelectField label="Ownership" de="Eigentumsverhältnisse" options={['Alleiniges Eigentum / Sole property', 'Belastet mit Rechten Dritter / Encumbered']} />
                <Field label="Details of third-party rights" de="Details Rechte Dritter" placeholder="Offener Kredit" full />
                <TextAreaField label="Known defects / prior damage" de="Bekannte Mängel/Vorschäden" placeholder="Describe any known defects / Bitte Mängel beschreiben" full />
                <TextAreaField label="Special equipment & accessories" de="Sonderausstattung & Zubehör" placeholder="AHK, Anhängerkupplung, Ledersitze…" full />
                <SelectField label="Mounted tires" de="Montierte Bereifung" options={['Sommer / Summer', 'Winter / Winter', 'Allwetter / All-season']} />
                <SelectField label="Tire profile" de="Reifenprofil" options={['Neu / New', 'Gut / Good', 'Brauchbar / Usable', 'Verschlissen / Worn']} />
                <SelectField label="Additional wheelset" de="Zusätzlicher Radsatz" options={['Keiner / None', 'Sommer / Summer', 'Winter / Winter', 'Allwetter / All-season']} />
                <SelectField label="Spare wheel" de="Reserverad" options={['Ja / Yes', 'Nein / No']} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tread depth (mm) [Profiltiefe (mm)] — for Kaufvertrag</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <Field label="Front left / VL" de="Profiltiefe" type="number" placeholder="mm" />
                    <Field label="Front right / VR" de="Profiltiefe" type="number" placeholder="mm" />
                    <Field label="Rear left / HL" de="Profiltiefe" type="number" placeholder="mm" />
                    <Field label="Rear right / HR" de="Profiltiefe" type="number" placeholder="mm" />
                  </div>
                </div>
              </>
            )}

            {/* STEP 4: Price & Package */}
            {step === 4 && (
              <>
                <SectionTitle num={4} en="Price & Service Package" de="Preis & Leistungspaket" />
                <Field label="Minimum sale price (€)" de="Mindestverkaufspreis (€)" required type="number" placeholder="15000" />
                <Field label="Final purchase price (€) — for Kaufvertrag" de="Kaufpreis (€)" required type="number" placeholder="16200" />
                <SelectField label="Service package" de="Leistungspaket" required options={[
                  'Essential – €347 (4 weeks / Wochen)',
                  'Advanced – €1,247 (8 weeks / Wochen)',
                  'Concierge – €2,497 (12 weeks / Wochen)',
                ]} full />
                <Field label="Special agreements" de="Sondervereinbarungen" placeholder="Anything else agreed / Sonstige Absprachen" full />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Additional services (optional) / Zusatzservices (optional)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <ServiceItem label="Vehicle detailing" de="Fahrzeugaufbereitung" />
                    <ServiceItem label="Extra cleaning" de="Zusätzliche Reinigung" />
                    <ServiceItem label="HU/AU renewal" de="HU/AU-Auffrischung" />
                    <ServiceItem label="TÜV/DEKRA condition certificate" de="Zustandszertifikat" />
                    <ServiceItem label="Appraisal / valuation" de="Wert-/Zustandsgutachten" />
                    <ServiceItem label="Service arrangement" de="Service-Vermittlung" />
                    <ServiceItem label="Pickup & delivery" de="Hol- und Bringservice" />
                    <ServiceItem label="Vehicle transport" de="Überführungsservice" />
                    <ServiceItem label="Marketing boost" de="Marketing-Boost" />
                    <ServiceItem label="Sorglos insurance package" de="Sorglos-Paket-Versicherung" />
                    <ServiceItem label="Storage fees" de="Standgeldgebühren" />
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
                <SectionTitle num={5} en="Handover & Documents" de="Übergabe & Dokumente" />
                <SelectField label="Will the vehicle be stored with CAR-AGENTS during marketing?" de="Fahrzeug beim Makler abgestellt?" required full
                  options={['Ja / Yes', 'Nein / No']} />
                <SelectField label="Storage / risk option" de="Verwahrungsoption" full options={[
                  'Option A – Own insurance / Eigene Versicherung',
                  'Option B – Sorglos package / Sorglos-Paket (paid)',
                  'Option C – Own risk without comprehensive cover / Eigenrisiko',
                ]} />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Documents handed over / Übergebene Unterlagen</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--gray-50,#f9fafb)', padding: 14, borderRadius: 10 }}>
                    <CheckItem label="Registration Certificate Part I" de="Zulassungsbescheinigung Teil I" />
                    <CheckItem label="Registration Certificate Part II" de="Zulassungsbescheinigung Teil II" />
                    <CheckItem label="COC paper" de="COC-Papier" />
                    <CheckItem label="Service booklet" de="Serviceheft" />
                  </div>
                </div>
                <Field label="Number of keys handed over" de="Anzahl übergebener Schlüssel" type="number" placeholder="2" />
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
