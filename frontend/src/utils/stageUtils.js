/**
 * Shared CRM pipeline constants — used by Projects.jsx and DealDetailPanel.jsx
 * Kept in a separate file to avoid circular imports.
 */

export const STAGES = [
  'Intake & Onboarding',
  'Sourcing & Inspection',
  'Marketing & Listing',
  'Negotiation & Contract',
  'Completed & Delivered'
];

export function getNormalizedStage(rawStage) {
  if (!rawStage) return STAGES[0];
  const s = String(rawStage).trim();
  const lower = s.toLowerCase();

  if (lower.includes('intake') || lower.includes('onboard') || lower.includes('lead capture') || lower.includes('requirement')) {
    return 'Intake & Onboarding';
  }
  if (lower.includes('sourc') || lower.includes('inspect')) {
    return 'Sourcing & Inspection';
  }
  if (lower.includes('market') || lower.includes('list')) {
    return 'Marketing & Listing';
  }
  if (lower.includes('contract') || lower.includes('sign') || lower.includes('pay') || lower.includes('settle') || lower.includes('negotiat')) {
    return 'Negotiation & Contract';
  }
  if (lower.includes('handover') || lower.includes('deliver') || lower.includes('complet') || lower.includes('close')) {
    return 'Completed & Delivered';
  }

  return STAGES[0];
}
