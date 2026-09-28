/**
 * frontend/src/utils/complianceUtils.js — CAR-AGENTS Compliance Hard Gates & GwG/GDPR Rules
 * Enforces CA-001, CA-012, CA-013, CA-014, CA-029 requirements.
 */

const COMPLIANCE_TAG_REGEX = /\[COMPLIANCE\]([\s\S]*?)\[\/COMPLIANCE\]/i;

export function parseCompliance(notes) {
  const defaults = {
    agb_signed: false,
    fairplay_checked: false,
    waiver_signed: false,
    setup_fee_paid: false,
    gdpr_consent: false,
    aml_verified: false,
    verified_at: null,
    verified_by: null
  };

  if (!notes) return defaults;

  const match = String(notes).match(COMPLIANCE_TAG_REGEX);
  if (!match) return defaults;

  try {
    const parsed = JSON.parse(match[1]);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function serializeCompliance(notes, complianceObj) {
  const currentNotes = String(notes || '').replace(COMPLIANCE_TAG_REGEX, '').trim();
  const complianceJson = JSON.stringify(complianceObj, null, 2);
  const tagBlock = `\n\n[COMPLIANCE]\n${complianceJson}\n[/COMPLIANCE]`;
  return `${currentNotes}${tagBlock}`.trim();
}

/**
 * Validates whether a project satisfies all legal and regulatory hard gates
 * before advancing to the requested target stage.
 */
export function checkStageTransitionGates(project, targetStage) {
  const compliance = parseCompliance(project?.notes);
  const stage = String(targetStage || '').toLowerCase();
  const price = Math.max(
    parseFloat(project?.target_price || 0),
    parseFloat(project?.purchase_price || 0),
    parseFloat(project?.agreed_sale_price || 0)
  );

  const missingGates = [];
  const amlRequired = price >= 10000;

  // Gate 1: Advancing past Intake & Onboarding (e.g. to Sourcing, Marketing, Contract, Completed)
  if (stage.includes('sourc') || stage.includes('inspect') || stage.includes('market') || stage.includes('contract') || stage.includes('complet')) {
    if (!compliance.setup_fee_paid) {
      missingGates.push({
        id: 'setup_fee_paid',
        label: 'Setup Fee Acknowledged / Paid (€349)',
        desc: 'Brokerage setup fee confirmation required before commitment of sourcing/inspection labor.'
      });
    }
    if (!compliance.gdpr_consent) {
      missingGates.push({
        id: 'gdpr_consent',
        label: 'GDPR Consent Timestamp Recorded',
        desc: 'Consent under Art. 6(1)(b) DSGVO for automotive procurement / data processing.'
      });
    }
  }

  // Gate 2: Advancing to Negotiation & Contract or Marketing
  if (stage.includes('contract') || stage.includes('negotiat') || stage.includes('complet')) {
    if (!compliance.agb_signed) {
      missingGates.push({
        id: 'agb_signed',
        label: 'Signed AGB (Brokerage Terms & Conditions)',
        desc: 'Legally binding brokerage agreement must be executed.'
      });
    }
    if (!compliance.fairplay_checked) {
      missingGates.push({
        id: 'fairplay_checked',
        label: 'Fairplay-Check Completed',
        desc: 'Pre-check for transparent price evaluation and vehicle market eligibility.'
      });
    }
    if (!compliance.waiver_signed) {
      missingGates.push({
        id: 'waiver_signed',
        label: '14-Day Immediate-Start Withdrawal Waiver (Widerrufsverzicht)',
        desc: 'Mandatory consumer waiver for immediate broker service commencement.'
      });
    }
  }

  // Gate 3: Advancing to Completed & Delivered
  if (stage.includes('complet') || stage.includes('deliver') || stage.includes('handover')) {
    if (amlRequired && !compliance.aml_verified) {
      missingGates.push({
        id: 'aml_verified',
        label: `AML / GwG Source-of-Funds Proof (Deal: €${price.toLocaleString('de-DE')})`,
        desc: 'Required under German GwG for transactions ≥ €10,000. Cash cap strictly €9,999.'
      });
    }
  }

  return {
    allowed: missingGates.length === 0,
    missingGates,
    compliance,
    amlRequired,
    price
  };
}
