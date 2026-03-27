import React, { useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Video,
  Copy,
  MessageSquare,
  UserCheck,
  LinkIcon,
  Zap,
} from 'lucide-react-native';
import BadgePill, { getBadgeColor } from '@/components/ui/BadgePill';
import Colors from '@/constants/colors';
import { styles } from './resultStyles';
import {
  formatScoreImpact,
  getProviderLabel,
  getStatusColor,
  getStatusLabel,
} from '@/utils/evidenceEngine';
import type { ScoreBreakdown, EvidenceStatus, BadgeType } from '@/types/scan';

type ReasonKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface TopReason {
  key: string;
  title: string;
  summary: string;
}

export interface EvidenceImpact {
  provider: string;
  status: EvidenceStatus;
  impact: number;
  summary: string;
}

interface Props {
  badge: BadgeType;
  score: number;
  domain: string;
  badgeColor: string;
  badgeBg: string;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
  loadingRemote: boolean;
  remoteError: string | null;
  scoreBreakdown: ScoreBreakdown | null;
  evidenceImpacts: EvidenceImpact[];
  topReasons: TopReason[];
  onDisclaimerPress: () => void;
  onScoreTooltipPress: () => void;
}

const REASON_ICONS: Record<ReasonKey, React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  A: Video,
  B: Copy,
  C: MessageSquare,
  D: UserCheck,
  E: LinkIcon,
  F: Zap,
};

function BadgeIcon({ badge, size = 24 }: { badge?: BadgeType; size?: number }) {
  const color = getBadgeColor(badge ?? 'UNVERIFIED');
  if (badge === 'VERIFIED') return <ShieldCheck size={size} color={color} strokeWidth={2} />;
  if (badge === 'UNVERIFIED') return <ShieldAlert size={size} color={color} strokeWidth={2} />;
  return <ShieldX size={size} color={color} strokeWidth={2} />;
}

export default function DecisionCard({
  badge,
  score,
  domain,
  badgeColor,
  badgeBg,
  fadeAnim,
  scaleAnim,
  loadingRemote,
  remoteError,
  scoreBreakdown,
  evidenceImpacts,
  topReasons,
  onDisclaimerPress,
  onScoreTooltipPress,
}: Props) {
  const [whyScoreOpen, setWhyScoreOpen] = useState(false);

  return (
    <Animated.View
      style={[
        styles.mainCard,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={styles.badgeSection}>
        <View style={[styles.badgeIconContainer, { backgroundColor: badgeBg, borderColor: `${badgeColor}40` }]}>
          <BadgeIcon badge={badge} size={40} />
        </View>
        <BadgePill badge={badge} size="hero" showSubtitle />
        <Text style={styles.domainText}>{domain}</Text>
      </View>

      <View style={styles.scoreSection}>
        <Pressable onPress={onScoreTooltipPress} style={styles.scoreCircle}>
          <Text style={[styles.scoreValue, { color: badgeColor }]}>{score}</Text>
          <Text style={styles.scoreLabel}>Risk Score</Text>
          <View style={styles.scoreTooltipIcon}>
            <Info size={10} color={Colors.textTertiary} strokeWidth={2} />
          </View>
        </Pressable>
        <View style={styles.scoreBarContainer}>
          <View style={styles.scoreBarTrack}>
            <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: badgeColor }]} />
          </View>
          <View style={styles.scoreLabels}>
            <Text style={styles.scoreLabelText}>0</Text>
            <Text style={styles.scoreLabelText}>100</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => setWhyScoreOpen(!whyScoreOpen)}
        style={({ pressed }) => [styles.whyScoreBtn, pressed && styles.whyScoreBtnPressed]}
      >
        <HelpCircle size={14} color={Colors.accent} strokeWidth={2} />
        <Text style={styles.whyScoreText}>Why this score?</Text>
        {whyScoreOpen
          ? <ChevronDown size={16} color={Colors.textTertiary} strokeWidth={2} />
          : <ChevronRight size={16} color={Colors.textTertiary} strokeWidth={2} />}
      </Pressable>

      {whyScoreOpen && (
        <View style={styles.whyScoreContent}>
          {scoreBreakdown && scoreBreakdown.adjustments.length > 0 ? (
            <>
              <View style={styles.scoreBreakdownHeader}>
                <Text style={styles.scoreBreakdownBase}>Base Score: {scoreBreakdown.baseScore}</Text>
              </View>
              {scoreBreakdown.adjustments.map((adj, idx) => (
                <View key={idx} style={styles.whyScoreRow}>
                  <View style={[styles.whyScoreIconWrap, { backgroundColor: adj.impact > 0 ? `${Colors.verified}20` : adj.impact < -20 ? `${Colors.highRisk}20` : `${Colors.unverified}20` }]}>
                    <Text style={[styles.impactText, { color: adj.impact > 0 ? Colors.verified : adj.impact < -20 ? Colors.highRisk : Colors.unverified }]}>
                      {formatScoreImpact(adj.impact)}
                    </Text>
                  </View>
                  <View style={styles.whyScoreTextWrap}>
                    <Text style={styles.whyScoreTitle}>{getProviderLabel(adj.provider)}</Text>
                    <Text style={styles.whyScoreSummary}>{adj.reason}</Text>
                  </View>
                  <View style={[styles.severityBadge, { backgroundColor: adj.severity === 'critical' ? `${Colors.highRisk}20` : adj.severity === 'major' ? `${Colors.unverified}20` : `${Colors.textTertiary}20` }]}>
                    <Text style={[styles.severityText, { color: adj.severity === 'critical' ? Colors.highRisk : adj.severity === 'major' ? Colors.unverified : Colors.textTertiary }]}>
                      {adj.severity.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={styles.scoreBreakdownFooter}>
                <Text style={styles.scoreBreakdownFinal}>Final Score: {scoreBreakdown.finalScore}</Text>
              </View>
            </>
          ) : evidenceImpacts.length > 0 ? (
            evidenceImpacts.map((item, idx) => (
              <View key={idx} style={styles.whyScoreRow}>
                <View style={[styles.whyScoreIconWrap, { backgroundColor: item.impact > 0 ? `${Colors.verified}20` : item.impact < -20 ? `${Colors.highRisk}20` : `${Colors.unverified}20` }]}>
                  <Text style={[styles.impactText, { color: item.impact > 0 ? Colors.verified : item.impact < -20 ? Colors.highRisk : Colors.unverified }]}>
                    {formatScoreImpact(item.impact)}
                  </Text>
                </View>
                <View style={styles.whyScoreTextWrap}>
                  <Text style={styles.whyScoreTitle}>{item.provider}</Text>
                  <Text style={styles.whyScoreSummary}>{item.summary}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                  <Text style={[styles.statusChipText, { color: getStatusColor(item.status) }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            ))
          ) : topReasons.length > 0 ? (
            topReasons.map((r, idx) => {
              const IC = REASON_ICONS[r.key as ReasonKey];
              return (
                <View key={idx} style={styles.whyScoreRow}>
                  <View style={styles.whyScoreIconWrap}>
                    <IC size={14} color={Colors.accent} strokeWidth={2} />
                  </View>
                  <View style={styles.whyScoreTextWrap}>
                    <Text style={styles.whyScoreTitle}>{r.title}</Text>
                    <Text style={styles.whyScoreSummary}>{r.summary}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.whyScoreBullet}>
              Not enough evidence to confirm authenticity. Use context and cross-check with other sources.
            </Text>
          )}
        </View>
      )}

      {badge === 'HIGH_RISK' && score >= 35 && score <= 50 && (
        <View style={styles.borderlineCard}>
          <AlertTriangle size={14} color={Colors.unverified} strokeWidth={2} />
          <View style={styles.borderlineTextWrap}>
            <Text style={styles.borderlineTitle}>Borderline: additional review queued</Text>
            <Text style={styles.borderlineDesc}>This is not a final accusation—signals require verification.</Text>
          </View>
        </View>
      )}

      {loadingRemote && <Text style={styles.loadingText}>Loading shared result…</Text>}
      {!!remoteError && <Text style={styles.errorText}>{remoteError}</Text>}

      <View style={styles.heroSubtitleRow}>
        <Text style={styles.heroSubtitle}>Risk-based verification. Not absolute truth.</Text>
        <Pressable onPress={onDisclaimerPress} style={({ pressed }) => [styles.infoBtn, pressed && styles.infoBtnPressed]}>
          <Info size={16} color={Colors.textTertiary} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
