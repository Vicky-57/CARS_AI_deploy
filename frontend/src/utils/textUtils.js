/**
 * frontend/src/utils/textUtils.js — CAR-AGENTS Universal Text, Encoding & Data Sanitation
 */

// Common UTF-8 / Latin-1 Mojibake fix mapping for German text
const MOJIBAKE_MAP = [
  [/Ã¤/g, 'ä'], [/Ã„/g, 'Ä'],
  [/Ã¶/g, 'ö'], [/Ã–/g, 'Ö'],
  [/Ã¼/g, 'ü'], [/Ãœ/g, 'Ü'],
  [/ÃŸ/g, 'ß'], [/â‚¬/g, '€'],
  [/Â/g, ''],   [/&amp;/g, '&'],
  [/&quot;/g, '"'], [/&#39;/g, "'"],
  [/&uuml;/g, 'ü'], [/&Uuml;/g, 'Ü'],
  [/&auml;/g, 'ä'], [/&Auml;/g, 'Ä'],
  [/&ouml;/g, 'ö'], [/&Ouml;/g, 'Ö'],
  [/&szlig;/g, 'ß'], [/&nbsp;/g, ' '],
];

/**
 * Universal text cleaner to eradicate \ufffd, mojibake, HTML entities,
 * and strip ugly raw UUID strings from user-facing screens.
 */
export function cleanText(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw);

  // 1. Remove unicode replacement chars and invisible control codes
  str = str.replace(/[\ufffd\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ');

  // 2. Fix German Mojibake & common HTML entities
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    str = str.replace(pattern, replacement);
  }

  // 3. Clean up raw UUID lead conversion strings like:
  // "Converted from Lead ID 632437f9-595d-44d6-aab2-f50ca71e3a0a"
  str = str.replace(/Converted from Lead ID\s+[0-9a-fA-F-]{32,36}/gi, 'Converted from Lead (Inquiry transferred to Project)');
  str = str.replace(/Lead ID\s+[0-9a-fA-F-]{32,36}/gi, 'Lead Reference');

  return str.trim();
}

/**
 * Formats a clean, human-readable summary for customer interaction logs
 * so raw internal database IDs are NEVER exposed to the broker or client.
 */
export function formatInteractionSummary(inter) {
  if (!inter) return 'Activity logged';
  const isProject = inter.type === 'Project' || inter.type === 'PROJECT';
  const d = inter.details || {};

  if (isProject) {
    const vehicle = d.target_vehicle || (d.vin ? `VIN: ${d.vin}` : null);
    const pType = (d.project_type || 'DEAL').toUpperCase() === 'SELL' ? 'Sell Mandate' : 'Buy Mandate';
    const priceStr = d.purchase_price ? ` (€${Number(d.purchase_price).toLocaleString('de-DE')})` : '';
    
    // Check if there are human notes (excluding raw UUID strings)
    let notes = cleanText(d.notes || '');
    if (notes.startsWith('Converted from Lead (Inquiry transferred to Project)')) {
      notes = ''; // Keep it clean
    }

    if (vehicle) {
      return `Project: ${vehicle} — ${pType}${priceStr}${notes ? ` • ${notes}` : ''}`;
    }
    return notes || `Active ${pType} Project${priceStr}`;
  }

  // For Leads
  const vehicle = d.manufacturer || d.model
    ? `${d.manufacturer || ''} ${d.model || ''}`.trim()
    : (d.vehicle_interest || cleanText(d.subject) || null);
  const intent = (d.intent || '').toUpperCase().includes('SELL') ? 'Sell Inquiry' : 'Buy Inquiry';
  
  if (vehicle && vehicle !== 'General Inquiry') {
    return `${intent}: ${cleanText(vehicle)}`;
  }

  const cleanSubject = cleanText(d.subject);
  if (cleanSubject) {
    return `${intent}: ${cleanSubject}`;
  }

  const cleanMsg = cleanText(d.message || d.notes);
  if (cleanMsg) {
    return `${intent}: ${cleanMsg.slice(0, 100)}${cleanMsg.length > 100 ? '…' : ''}`;
  }

  return `${intent} Logged`;
}

/**
 * Validates Vehicle Identification Number (VIN) according to ISO 3779:
 * Exactly 17 alphanumeric characters, excluding I, O, and Q.
 */
export function isValidVIN(vin) {
  if (!vin) return false;
  const cleanVin = String(vin).trim().toUpperCase();
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
  return vinRegex.test(cleanVin);
}

/**
 * Basic email regex check.
 */
export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Basic phone validation check (at least 6 digits/symbols).
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 6;
}
