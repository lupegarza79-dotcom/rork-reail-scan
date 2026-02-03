// utils/evidenceEngine.ts
// Deterministic scoring engine for Evidence Pack
// Score ≠ Truth. It's risk-based verification backed by evidence cards.

import type {
  BadgeType,
  EvidenceCard,
  EvidenceStatus,
  EvidenceProvider,
  ScoreBreakdown,
  ScoreAdjustment,
  LinkIntelPayload,
  DomainIntelPayload,
  PatternMatchPayload,
} from '@/types/scan';

const BASE_SCORE = 70;

const SCORING_RULES = {
  suspiciousRedirectChain: { impact: -25, severity: 'major' as const, reason: 'Suspicious redirect chain detected' },
  doubleHopRedirect: { impact: -15, severity: 'major' as const, reason: 'Double-hop redirect pattern' },
  punycodeOrLookalike: { impact: -30, severity: 'critical' as const, reason: 'Punycode or lookalike domain detected' },
  domainAgeLessThan30d: { impact: -15, severity: 'major' as const, reason: 'Domain less than 30 days old' },
  domainAgeLessThan7d: { impact: -25, severity: 'critical' as const, reason: 'Domain less than 7 days old' },
  suspiciousTld: { impact: -10, severity: 'minor' as const, reason: 'Suspicious TLD detected' },
  noMxRecords: { impact: -5, severity: 'info' as const, reason: 'No MX records found' },
  highAsnRisk: { impact: -15, severity: 'major' as const, reason: 'High-risk hosting provider/ASN' },
  patternMatchPhishing: { impact: -30, severity: 'critical' as const, reason: 'Phishing pattern match' },
  patternMatchScam: { impact: -20, severity: 'major' as const, reason: 'Known scam pattern detected' },
  excessiveTrackingParams: { impact: -5, severity: 'info' as const, reason: 'Excessive tracking parameters' },
  knownScamUrl: { impact: -40, severity: 'critical' as const, reason: 'Known scam URL match' },
  recentDomainUpdate: { impact: -10, severity: 'minor' as const, reason: 'Recent domain registration changes' },
  shortlinkToSuspicious: { impact: -10, severity: 'minor' as const, reason: 'Shortlink leads to suspicious destination' },
  unverifiedAccount: { impact: -5, severity: 'info' as const, reason: 'Unverified social account' },
  lowEngagement: { impact: -5, severity: 'info' as const, reason: 'Suspicious engagement patterns' },
  evidenceIncomplete: { impact: -10, severity: 'minor' as const, reason: 'Evidence pack incomplete' },
  passLinkIntel: { impact: 5, severity: 'info' as const, reason: 'Link intel passed' },
  passDomainIntel: { impact: 5, severity: 'info' as const, reason: 'Domain intel passed' },
  passSocialContext: { impact: 5, severity: 'info' as const, reason: 'Social context passed' },
  passPatternMatch: { impact: 10, severity: 'info' as const, reason: 'No pattern matches found' },
};

export const PROVIDER_LABELS: Record<EvidenceProvider | string, string> = {
  link_intel: 'Link Intel',
  domain_intel: 'Domain Intel',
  social_context: 'Social Context',
  pattern_match: 'Pattern Match',
};

export const PROVIDER_DESCRIPTIONS: Record<EvidenceProvider | string, string> = {
  link_intel: 'URL reputation and redirect analysis',
  domain_intel: 'Domain age, registration, and history',
  social_context: 'Platform signals and engagement patterns',
  pattern_match: 'Known scam and fraud pattern detection',
};

export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getProviderDescription(provider: string): string {
  return PROVIDER_DESCRIPTIONS[provider] || 'Analysis provider';
}

function calculateLinkIntelAdjustments(payload: LinkIntelPayload): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];

  if (payload.suspiciousRedirect) {
    adjustments.push({ provider: 'link_intel', ...SCORING_RULES.suspiciousRedirectChain });
  }

  if (payload.hasDoubleHop) {
    adjustments.push({ provider: 'link_intel', ...SCORING_RULES.doubleHopRedirect });
  }

  if ((payload.redirectCount ?? 0) > 3 && !payload.suspiciousRedirect) {
    adjustments.push({ 
      provider: 'link_intel', 
      impact: -5, 
      severity: 'info', 
      reason: `${payload.redirectCount} redirects detected` 
    });
  }

  if ((payload.trackingParams?.length ?? 0) > 5) {
    adjustments.push({ provider: 'link_intel', ...SCORING_RULES.excessiveTrackingParams });
  }

  if (adjustments.length === 0) {
    adjustments.push({ provider: 'link_intel', ...SCORING_RULES.passLinkIntel });
  }

  return adjustments;
}

function calculateDomainIntelAdjustments(payload: DomainIntelPayload): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];

  if (payload.isPunycode || payload.isLookalike) {
    adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.punycodeOrLookalike });
  }

  const domainAgeDays = payload.domainAgeDays ?? payload.domainAge;
  if (domainAgeDays !== undefined) {
    if (domainAgeDays < 7) {
      adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.domainAgeLessThan7d });
    } else if (domainAgeDays < 30) {
      adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.domainAgeLessThan30d });
    }
  }

  if (payload.suspiciousTld) {
    adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.suspiciousTld });
  }

  if (payload.hasMxRecords === false) {
    adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.noMxRecords });
  }

  if (payload.asnRisk === 'high') {
    adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.highAsnRisk });
  }

  if (adjustments.length === 0) {
    adjustments.push({ provider: 'domain_intel', ...SCORING_RULES.passDomainIntel });
  }

  return adjustments;
}

function calculatePatternMatchAdjustments(payload: PatternMatchPayload): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];

  if (payload.knownScamMatch) {
    adjustments.push({ provider: 'pattern_match', ...SCORING_RULES.knownScamUrl });
  }

  if ((payload.phishingScore ?? 0) > 70) {
    adjustments.push({ provider: 'pattern_match', ...SCORING_RULES.patternMatchPhishing });
  } else if ((payload.phishingScore ?? 0) > 40) {
    adjustments.push({ provider: 'pattern_match', ...SCORING_RULES.patternMatchScam });
  }

  if ((payload.matchedPatterns?.length ?? 0) > 0 && !payload.knownScamMatch) {
    adjustments.push({ 
      provider: 'pattern_match', 
      impact: -5 * (payload.matchedPatterns?.length ?? 0), 
      severity: 'minor', 
      reason: `${payload.matchedPatterns?.length} suspicious patterns detected` 
    });
  }

  if (adjustments.length === 0) {
    adjustments.push({ provider: 'pattern_match', ...SCORING_RULES.passPatternMatch });
  }

  return adjustments;
}

export function calculateScoreFromEvidence(evidence: EvidenceCard[]): ScoreBreakdown {
  const adjustments: ScoreAdjustment[] = [];
  let hasLinkIntel = false;
  let hasDomainIntel = false;
  let hasCriticalFail = false;

  for (const card of evidence) {
    if (card.status === 'pending') continue;

    if (card.status === 'fail') {
      const isCritical = card.provider === 'pattern_match' || 
        (card.payload as DomainIntelPayload)?.isPunycode ||
        (card.payload as DomainIntelPayload)?.isLookalike ||
        (card.payload as PatternMatchPayload)?.knownScamMatch;
      
      if (isCritical) hasCriticalFail = true;
    }

    switch (card.provider) {
      case 'link_intel':
        hasLinkIntel = true;
        if (card.payload) {
          adjustments.push(...calculateLinkIntelAdjustments(card.payload as LinkIntelPayload));
        }
        break;
      case 'domain_intel':
        hasDomainIntel = true;
        if (card.payload) {
          adjustments.push(...calculateDomainIntelAdjustments(card.payload as DomainIntelPayload));
        }
        break;
      case 'pattern_match':
        if (card.payload) {
          adjustments.push(...calculatePatternMatchAdjustments(card.payload as PatternMatchPayload));
        }
        break;
      case 'social_context':
        if (card.status === 'pass') {
          adjustments.push({ provider: 'social_context', ...SCORING_RULES.passSocialContext });
        }
        break;
    }
  }

  const isIncomplete = !hasLinkIntel || !hasDomainIntel;
  if (isIncomplete) {
    adjustments.push({ provider: 'system', ...SCORING_RULES.evidenceIncomplete });
  }

  const totalImpact = adjustments.reduce((sum, adj) => sum + adj.impact, 0);
  const rawScore = BASE_SCORE + totalImpact;
  const finalScore = Math.max(0, Math.min(100, rawScore));

  let badge: BadgeType;
  if (hasCriticalFail || finalScore < 50) {
    badge = 'HIGH_RISK';
  } else if (finalScore >= 80 && !isIncomplete && !adjustments.some(a => a.severity === 'critical')) {
    badge = 'VERIFIED';
  } else {
    badge = 'UNVERIFIED';
  }

  return {
    baseScore: BASE_SCORE,
    adjustments,
    finalScore,
    badge,
  };
}

export function determineBadge(score: number, evidence: EvidenceCard[]): BadgeType {
  const hasCriticalFail = evidence.some(e => 
    e.status === 'fail' && (
      (e.payload as DomainIntelPayload)?.isPunycode ||
      (e.payload as DomainIntelPayload)?.isLookalike ||
      (e.payload as PatternMatchPayload)?.knownScamMatch ||
      (e.payload as PatternMatchPayload)?.phishingScore && (e.payload as PatternMatchPayload).phishingScore! > 70
    )
  );

  if (hasCriticalFail || score < 50) return 'HIGH_RISK';
  
  const isComplete = evidence.filter(e => e.status !== 'pending').length >= 2;
  const hasNoCriticalWarnings = !evidence.some(e => e.status === 'fail');
  
  if (score >= 80 && isComplete && hasNoCriticalWarnings) return 'VERIFIED';
  
  return 'UNVERIFIED';
}

export function getEvidenceScoreImpact(card: EvidenceCard): number {
  if (card.status === 'pending') return 0;
  if (card.scoreImpact !== undefined) return card.scoreImpact;
  
  switch (card.provider) {
    case 'link_intel':
      return card.status === 'pass' ? 5 : card.status === 'warn' ? -10 : -25;
    case 'domain_intel':
      return card.status === 'pass' ? 5 : card.status === 'warn' ? -15 : -30;
    case 'social_context':
      return card.status === 'pass' ? 5 : card.status === 'warn' ? -5 : -10;
    case 'pattern_match':
      return card.status === 'pass' ? 10 : card.status === 'warn' ? -20 : -40;
    default:
      return 0;
  }
}

export function formatScoreImpact(impact: number): string {
  if (impact > 0) return `+${impact}`;
  return String(impact);
}

export function getStatusColor(status: EvidenceStatus): string {
  switch (status) {
    case 'pass': return '#22C55E';
    case 'warn': return '#F59E0B';
    case 'fail': return '#EF4444';
    case 'pending': return '#6B7280';
    default: return '#6B7280';
  }
}

export function getStatusLabel(status: EvidenceStatus): string {
  switch (status) {
    case 'pass': return 'PASS';
    case 'warn': return 'WARN';
    case 'fail': return 'FAIL';
    case 'pending': return 'PENDING';
  }
}

export function buildEvidenceDetails(card: EvidenceCard): string[] {
  const details: string[] = [];
  const payload = card.payload;
  
  if (!payload) return details;

  switch (card.provider) {
    case 'link_intel': {
      const p = payload as LinkIntelPayload;
      if (p.redirectCount !== undefined) details.push(`Redirect count: ${p.redirectCount}`);
      if (p.hasDoubleHop) details.push('Double-hop redirect detected');
      if (p.shortlinkExpanded) details.push('Shortlink expanded');
      if (p.trackingParams?.length) details.push(`Tracking params: ${p.trackingParams.join(', ')}`);
      if (p.finalUrl && p.originalUrl !== p.finalUrl) details.push(`Final URL: ${p.finalUrl}`);
      break;
    }
    case 'domain_intel': {
      const p = payload as DomainIntelPayload;
      if (p.domainAgeDays !== undefined) details.push(`Domain age: ${p.domainAgeDays} days`);
      if (p.registrar) details.push(`Registrar: ${p.registrar}`);
      if (p.isPunycode) details.push('⚠️ Punycode domain detected');
      if (p.isLookalike) details.push(`⚠️ Lookalike domain (similar to ${p.lookalikeTo})`);
      if (p.suspiciousTld) details.push(`Suspicious TLD: .${p.tld}`);
      if (p.asnRisk) details.push(`Hosting risk: ${p.asnRisk}`);
      if (p.hasMxRecords !== undefined) details.push(`MX records: ${p.hasMxRecords ? 'Yes' : 'No'}`);
      break;
    }
    case 'pattern_match': {
      const p = payload as PatternMatchPayload;
      if (p.phishingScore !== undefined) details.push(`Phishing score: ${p.phishingScore}/100`);
      if (p.knownScamMatch) details.push('⚠️ Known scam URL match');
      if (p.matchedPatterns?.length) details.push(`Patterns: ${p.matchedPatterns.join(', ')}`);
      if (p.similarReportedUrls) details.push(`Similar reported URLs: ${p.similarReportedUrls}`);
      break;
    }
  }

  return details;
}

export const PLACEHOLDER_EVIDENCE: EvidenceCard[] = [
  { 
    id: 'link-intel', 
    provider: 'link_intel', 
    providerLabel: 'Link Intel',
    status: 'pending', 
    summary: 'URL reputation and redirect analysis',
    weight: 25,
    scoreImpact: 0,
  },
  { 
    id: 'domain-intel', 
    provider: 'domain_intel', 
    providerLabel: 'Domain Intel',
    status: 'pending', 
    summary: 'Domain age, registration, and history',
    weight: 30,
    scoreImpact: 0,
  },
  { 
    id: 'social-context', 
    provider: 'social_context', 
    providerLabel: 'Social Context',
    status: 'pending', 
    summary: 'Platform signals and engagement patterns',
    weight: 20,
    scoreImpact: 0,
  },
  { 
    id: 'pattern-match', 
    provider: 'pattern_match', 
    providerLabel: 'Pattern Match',
    status: 'pending', 
    summary: 'Known scam and fraud pattern detection',
    weight: 25,
    scoreImpact: 0,
  },
];
