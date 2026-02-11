import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { DomainTrustProfile, TrustTier } from '@/types/scan';

interface TrustGraphCardProps {
  profile: DomainTrustProfile | null;
  loading?: boolean;
}

function getTierColor(tier: TrustTier): string {
  switch (tier) {
    case 'trusted': return Colors.verified;
    case 'neutral': return Colors.textSecondary;
    case 'suspicious': return Colors.unverified;
    case 'malicious': return Colors.highRisk;
    default: return Colors.textTertiary;
  }
}

function getTierLabel(tier: TrustTier): string {
  switch (tier) {
    case 'trusted': return 'Trusted';
    case 'neutral': return 'Neutral';
    case 'suspicious': return 'Suspicious';
    case 'malicious': return 'Malicious';
    default: return 'Unknown';
  }
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function TrendIcon({ avgScore }: { avgScore: number }) {
  if (avgScore >= 70) return <TrendingUp size={14} color={Colors.verified} strokeWidth={2} />;
  if (avgScore <= 40) return <TrendingDown size={14} color={Colors.highRisk} strokeWidth={2} />;
  return <Minus size={14} color={Colors.textTertiary} strokeWidth={2} />;
}

export default function TrustGraphCard({ profile, loading }: TrustGraphCardProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Users size={16} color={Colors.accent} strokeWidth={2} />
          <Text style={styles.title}>Community Trust Graph</Text>
        </View>
        <View style={styles.skeletonRow}>
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      </View>
    );
  }

  if (!profile) return null;

  const tierColor = getTierColor(profile.trustTier);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Users size={16} color={Colors.accent} strokeWidth={2} />
        <Text style={styles.title}>Community Trust Graph</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{profile.totalScans}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: tierColor }]}>
            {getTierLabel(profile.trustTier)}
          </Text>
          <Text style={styles.statLabel}>Tier</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <View style={styles.trendRow}>
            <TrendIcon avgScore={profile.avgScore} />
            <Text style={styles.statValue}>{Math.round(profile.avgScore)}</Text>
          </View>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      <View style={styles.breakdownRow}>
        <View style={[styles.breakdownDot, { backgroundColor: Colors.verified }]} />
        <Text style={styles.breakdownText}>{profile.verifiedCount} verified</Text>
        <View style={[styles.breakdownDot, { backgroundColor: Colors.unverified }]} />
        <Text style={styles.breakdownText}>{profile.unverifiedCount} unverified</Text>
        <View style={[styles.breakdownDot, { backgroundColor: Colors.highRisk }]} />
        <Text style={styles.breakdownText}>{profile.highRiskCount} high risk</Text>
      </View>

      <View style={styles.footer}>
        <Clock size={12} color={Colors.textTertiary} strokeWidth={2} />
        <Text style={styles.footerText}>
          Last seen {getRelativeTime(profile.lastSeenAt)} · First seen {getRelativeTime(profile.firstSeenAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breakdownText: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginRight: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-around',
  },
  skeleton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.shimmer,
  },
});
