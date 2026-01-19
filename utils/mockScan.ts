import { ScanResult, BadgeType, ScanReasons } from '@/types/scan';

const platformPatterns: Record<string, ScanResult['platform']> = {
  'tiktok': 'tiktok',
  'instagram': 'instagram',
  'facebook': 'facebook',
  'youtube': 'youtube',
  'youtu.be': 'youtube',
  'fb.com': 'facebook',
  'ig.com': 'instagram',
};

export function detectPlatform(url: string): ScanResult['platform'] {
  const lowerUrl = url.toLowerCase();
  for (const [pattern, platform] of Object.entries(platformPatterns)) {
    if (lowerUrl.includes(pattern)) {
      return platform;
    }
  }
  if (lowerUrl.includes('news') || lowerUrl.includes('article')) {
    return 'news';
  }
  if (lowerUrl.includes('shop') || lowerUrl.includes('store') || lowerUrl.includes('buy')) {
    return 'shop';
  }
  return 'other';
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.split('/')[0].replace('www.', '');
  }
}

function generateScore(): { score: number; badge: BadgeType } {
  const random = Math.random();
  if (random > 0.6) {
    return { score: Math.floor(Math.random() * 21) + 80, badge: 'VERIFIED' };
  } else if (random > 0.25) {
    return { score: Math.floor(Math.random() * 30) + 50, badge: 'UNVERIFIED' };
  } else {
    return { score: Math.floor(Math.random() * 50), badge: 'HIGH_RISK' };
  }
}

function generateReasons(badge: BadgeType): ScanReasons {
  const isVerified = badge === 'VERIFIED';
  const isHighRisk = badge === 'HIGH_RISK';

  return {
    A: {
      title: 'Media Integrity',
      summary: isVerified 
        ? 'No editing artifacts detected' 
        : isHighRisk 
          ? 'Multiple editing artifacts found'
          : 'Some inconsistencies in media metadata',
      details: isVerified
        ? ['Frame consistency verified', 'Audio track matches video', 'No splicing detected']
        : isHighRisk
          ? ['Frame rate inconsistencies detected', 'Possible AI-generated elements', 'Metadata shows multiple edits']
          : ['Minor metadata inconsistencies', 'Unable to verify original source', 'Compression artifacts present'],
      suggestion: 'Look for the original source with higher quality media.',
    },
    B: {
      title: 'Duplicate / Re-used Media',
      summary: isVerified
        ? 'Content appears to be original'
        : isHighRisk
          ? 'Similar content found from different sources'
          : 'Partial matches found in media databases',
      details: isVerified
        ? ['No duplicates found in reverse image search', 'First appearance matches claimed date']
        : isHighRisk
          ? ['Same video posted by 5+ different accounts', 'Original upload date conflicts with claims', 'Used in known misinformation campaigns']
          : ['Similar images exist but context differs', 'Unable to confirm original creator'],
      suggestion: 'Search for the media on multiple platforms to find the original.',
    },
    C: {
      title: 'Claims vs Public Signals',
      summary: isVerified
        ? 'Claims align with verified sources'
        : isHighRisk
          ? 'Claims contradict established facts'
          : 'Claims cannot be independently verified',
      details: isVerified
        ? ['Statements match official records', 'Quotes verified against source', 'Timeline is consistent']
        : isHighRisk
          ? ['Key claims debunked by fact-checkers', 'Statistics are fabricated or misleading', 'Quotes taken out of context']
          : ['No official sources confirm claims', 'Mixed signals from reliable sources'],
      suggestion: 'Cross-reference claims with official sources and fact-checking sites.',
    },
    D: {
      title: 'Account Signals',
      summary: isVerified
        ? 'Account has established credibility'
        : isHighRisk
          ? 'Account shows suspicious patterns'
          : 'Account history is limited',
      details: isVerified
        ? ['Account age: 3+ years', 'Consistent posting history', 'Verified by platform']
        : isHighRisk
          ? ['Account created recently', 'Unusual posting frequency', 'Bot-like behavior detected']
          : ['Account age: under 1 year', 'Limited engagement history', 'No verification badge'],
      suggestion: 'Check the account\'s posting history and follower authenticity.',
    },
    E: {
      title: 'Link Safety',
      summary: isVerified
        ? 'Link is safe and secure'
        : isHighRisk
          ? 'Link shows security concerns'
          : 'Link safety could not be fully verified',
      details: isVerified
        ? ['HTTPS enabled', 'Domain is reputable', 'No malware detected']
        : isHighRisk
          ? ['Suspicious redirects detected', 'Domain flagged in security databases', 'Possible phishing attempt']
          : ['Domain is relatively new', 'Limited security history', 'Some tracking parameters present'],
      suggestion: 'Use a URL scanner to check for malware before clicking.',
    },
    F: {
      title: 'Patterns / Reports',
      summary: isVerified
        ? 'No concerning patterns detected'
        : isHighRisk
          ? 'Multiple user reports received'
          : 'Limited community data available',
      details: isVerified
        ? ['No user reports', 'Content follows platform guidelines', 'Engagement appears organic']
        : isHighRisk
          ? ['Flagged by multiple users', 'Similar to known scam patterns', 'Engagement appears artificial']
          : ['Few user reports exist', 'Pattern analysis inconclusive'],
      suggestion: 'Check community forums for reports about this content.',
    },
  };
}

export function generateMockScan(url: string): ScanResult {
  const { score, badge } = generateScore();
  const platform = detectPlatform(url);
  const domain = extractDomain(url);

  return {
    id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    url,
    domain,
    platform,
    badge,
    score,
    reasons: generateReasons(badge),
    timestamp: Date.now(),
    title: `Content from ${domain}`,
  };
}
