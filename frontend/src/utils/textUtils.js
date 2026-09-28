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
 * Universal text cleaner to eradicate literal \ufffd, unicode replacement chars,
 * mojibake, HTML entities, and strip ugly raw UUID strings from user-facing screens.
 */
export function cleanText(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw);

  // 1. Remove literal escaped \ufffd, \\ufffd, and unicode replacement chars/control codes
  str = str.replace(/(\\+u[fF]{3}[dD]|[\ufffd\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F])+/gi, ' ');

  // 2. Fix German Mojibake & common HTML entities
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    str = str.replace(pattern, replacement);
  }

  // 3. Fix German words where umlaut was corrupted or stripped
  str = str.replace(/\bKfz-Sachverstndiger\b/gi, 'Kfz-Sachverständiger');
  str = str.replace(/\bSachverstndiger\b/gi, 'Sachverständiger');
  str = str.replace(/\bknnen\b/gi, 'können');
  str = str.replace(/\bwrde\b/gi, 'würde');
  str = str.replace(/Schne Gre/gi, 'Schöne Grüße');
  str = str.replace(/\benthlt\b/gi, 'enthält');
  str = str.replace(/\s+fr\s+/gi, ' für ');

  // 4. Clean up raw UUID lead conversion strings like:
  // "Converted from Lead ID 632437f9-595d-44d6-aab2-f50ca71e3a0a"
  str = str.replace(/Converted from Lead ID\s+[0-9a-fA-F-]{32,36}/gi, 'Converted from Lead (Inquiry transferred to Project)');
  str = str.replace(/Lead ID\s+[0-9a-fA-F-]{32,36}/gi, 'Lead Reference');

  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Detects automated newsletters, phishing tickets, and spam addresses.
 */
export function isAutomatedSpam(item = {}) {
  const email = (item.email || '').toLowerCase().trim();
  const name = (item.name || '').toLowerCase().trim();
  const subject = (item.subject || '').toLowerCase().trim();
  const notes = (item.notes || item.message || '').toLowerCase().trim();

  // Spam domains & prefixes
  const spamKeywords = [
    'doctolib', 'deutschland ticket', 'ticket', 'commerzbank',
    'auto1.com', 'finance@kleinanzeigen.de', 'meditation-journal',
    'enilive.com', 'carvertical.com', 'signselector.de',
    'no-reply', 'noreply', 'donotreply', 'newsletter', 'bounce', 'mailer-daemon'
  ];

  if (spamKeywords.some(k => email.includes(k) || name.includes(k) || subject.includes(k))) return true;

  // Random temporary phishing domain extensions (.rrl, .qju, .fqj, .iua, .mhw)
  if (/@\w+\.(rrl|qju|fqj|iua|mhw)$/i.test(email)) return true;

  // Known notification subjects
  if (notes.includes('lastschriftankündigung') || notes.includes('rechnung kleinanzeigen') || notes.includes('deine bestellung ist auf dem weg')) {
    return true;
  }

  return false;
}

/**
 * Formats contact name nicely. If the name is a mobile.de hashed proxy address
 * (e.g. 31hjkl...-mo-mo@kontakt.mobile.de), displays a clean friendly title.
 */
export function formatContactName(name, email, vehicle) {
  const cleaned = cleanText(name);
  const em = (email || '').toLowerCase().trim();

  // Check if name is a mobile.de relay proxy hash or raw email
  const isMobileDeRelay = /-mo-mo@kontakt\.mobile\.de/i.test(cleaned) || /-mo-mo@kontakt\.mobile\.de/i.test(em);
  const isRawEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);

  if (isMobileDeRelay && (isRawEmail || !cleaned || cleaned === em)) {
    return vehicle && vehicle !== 'General Inquiry' 
      ? `mobile.de Prospect (${cleanText(vehicle)})` 
      : 'mobile.de Inquiry';
  }

  if (isRawEmail) {
    const userPart = cleaned.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
    return userPart.length > 2 
      ? userPart.charAt(0).toUpperCase() + userPart.slice(1) 
      : (vehicle || 'Client Inquiry');
  }

  return cleaned || 'Client';
}

/**
 * Computes clean 1-2 character initials for avatars without ugly slashes or hashes.
 */
export function getCleanInitials(name, email) {
  const clean = cleanText(name);
  if (!clean || /-mo-mo@kontakt\.mobile\.de/i.test(clean) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return 'MO'; // mobile.de / inquiry
  }
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
