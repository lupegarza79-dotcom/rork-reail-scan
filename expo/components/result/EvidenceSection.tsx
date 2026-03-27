import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  FileCheck,
  FileQuestion,
  FileX,
  FileClock,
  ChevronDown,
  ChevronRight,
  Info,
  Bot,
  User,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { styles } from './resultStyles';
import {
  getProviderLabel,
  getEvidenceScoreImpact,
  formatScoreImpact,
  getStatusLabel,
  buildEvidenceDetails,
} from '@/utils/evidenceEngine';
import type { EvidenceCard as EvidenceCardType, EvidenceStatus } from '@/types/scan';

type ContentMetricsLocal = {
  aiProbability?: number;
  humanProbability?: number;
  authenticityScore?: number;
  manipulationRisk?: number;
  scamIndicators?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
};

interface Props {
  evidenceCards: EvidenceCardType[];
  hasRealEvidence: boolean;
  summary?: string;
  metrics?: ContentMetricsLocal;
}

function getEvidenceStatusIcon(status: EvidenceStatus) {
  switch (status) {
    case 'pass': return <FileCheck size={18} color={Colors.verified} strokeWidth={2} />;
    case 'warn': return <FileQuestion size={18} color={Colors.unverified} strokeWidth={2} />;
    case 'fail': return <FileX size={18} color={Colors.highRisk} strokeWidth={2} />;
    case 'pending': return <FileClock size={18} color={Colors.textTertiary} strokeWidth={2} />;
    default: return <FileQuestion size={18} color={Colors.textTertiary} strokeWidth={2} />;
  }
}

function getEvidenceStatusColor(status: EvidenceStatus) {
  switch (status) {
    case 'pass': return Colors.verified;
    case 'warn': return Colors.unverified;
    case 'fail': return Colors.highRisk;
    default: return Colors.textTertiary;
  }
}

function getConfidenceColor(level: string | undefined): string {
  if (level === 'high') return Colors.verified;
  if (level === 'medium') return Colors.unverified;
  return Colors.textTertiary;
}

function getConfidenceLabel(level: string | undefined): string {
  if (level === 'high') return 'HIGH';
  if (level === 'medium') return 'MED';
  return 'LOW';
}

export default function EvidenceSection({ evidenceCards, hasRealEvidence, summary, metrics }: Props) {
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const toggleEvidenceExpand = useCallback((id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <>
      <View style={styles.evidenceSection}>
        <View style={styles.evidenceTitleRow}>
          <Text style={styles.sectionTitle}>Evidence Pack</Text>
          <View style={styles.evidenceHint}>
            <Info size={12} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.evidenceHintText}>Unlocks verified status</Text>
          </View>
        </View>
        <Text style={styles.sectionSubtitle}>
          {hasRealEvidence ? 'Verification sources and signals' : 'Verification requires evidence, not claims'}
        </Text>

        {!!summary && (
          <View style={styles.evidenceSummaryCard}>
            <Text style={styles.evidenceSummaryText}>{summary}</Text>
          </View>
        )}

        {evidenceCards.map((item) => {
          const isOpen = expandedEvidence[item.id] ?? false;
          const isPending = item.status === 'pending';
          const impact = getEvidenceScoreImpact(item);
          const details = item.payload ? buildEvidenceDetails(item) : [];
          const providerLabel = item.providerLabel || getProviderLabel(item.provider);

          return (
            <Pressable
              key={item.id}
              onPress={() => !isPending && (item.payload || details.length > 0) && toggleEvidenceExpand(item.id)}
              style={({ pressed }) => [
                styles.evidenceCard,
                isPending && styles.evidenceCardPending,
                pressed && !isPending && styles.evidenceCardPressed,
              ]}
            >
              <View style={styles.evidenceHeader}>
                <View style={[styles.evidenceIconContainer, isPending && styles.evidenceIconPending]}>
                  {getEvidenceStatusIcon(item.status)}
                </View>
                <View style={styles.evidenceContentWrapper}>
                  <View style={styles.evidenceProviderRow}>
                    <Text style={[styles.evidenceProvider, isPending && styles.evidenceProviderPending]}>
                      {providerLabel}
                    </Text>
                    <View style={[styles.evidenceStatusBadge, { backgroundColor: `${getEvidenceStatusColor(item.status)}20` }]}>
                      <Text style={[styles.evidenceStatusText, { color: getEvidenceStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                    {!isPending && impact !== 0 && (
                      <View style={[styles.evidenceImpactBadge, { backgroundColor: impact > 0 ? `${Colors.verified}20` : `${Colors.highRisk}20` }]}>
                        <Text style={[styles.evidenceImpactText, { color: impact > 0 ? Colors.verified : Colors.highRisk }]}>
                          {formatScoreImpact(impact)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.evidenceSummary, isPending && styles.evidenceSummaryPending]} numberOfLines={isOpen ? undefined : 2}>
                    {isPending ? 'Coming soon' : item.summary}
                  </Text>
                  {item.weight !== undefined && !isPending && (
                    <Text style={styles.evidenceWeight}>Weight: {item.weight}%</Text>
                  )}
                </View>
                {(item.payload || details.length > 0) && !isPending && (
                  isOpen
                    ? <ChevronDown size={18} color={Colors.textTertiary} strokeWidth={2} />
                    : <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={2} />
                )}
              </View>

              {isOpen && (details.length > 0 || item.payload) && (
                <View style={styles.evidencePayload}>
                  {details.length > 0 && (
                    <View style={styles.evidenceDetailsSection}>
                      <Text style={styles.evidencePayloadTitle}>Details</Text>
                      {details.map((d, i) => (
                        <Text key={i} style={styles.evidenceDetailItem}>• {d}</Text>
                      ))}
                    </View>
                  )}
                  {item.payload && (
                    <View style={styles.evidenceRawSection}>
                      <Text style={styles.evidencePayloadTitle}>Raw Data</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={styles.evidencePayloadText}>
                          {JSON.stringify(item.payload, null, 2)}
                        </Text>
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {metrics && (
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Signals</Text>
          <Text style={styles.sectionSubtitle}>Content patterns and risk indicators</Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Bot size={16} color={Colors.accent} strokeWidth={2} />
                <Text style={styles.metricLabel}>AI Probability</Text>
              </View>
              <Text style={styles.metricSubtitle}>content-level</Text>
              <Text style={[styles.metricValue, { color: (metrics.aiProbability ?? 0) > 50 ? Colors.highRisk : Colors.verified }]}>
                {metrics.aiProbability ?? 50}%
              </Text>
              <View style={styles.metricBar}>
                <View style={[styles.metricBarFill, { width: `${metrics.aiProbability ?? 50}%`, backgroundColor: (metrics.aiProbability ?? 0) > 50 ? Colors.highRisk : Colors.verified }]} />
              </View>
              <View style={[styles.confidenceChip, { backgroundColor: `${getConfidenceColor(metrics.confidenceLevel)}20` }]}>
                <Text style={[styles.confidenceChipText, { color: getConfidenceColor(metrics.confidenceLevel) }]}>
                  {getConfidenceLabel(metrics.confidenceLevel)}
                </Text>
              </View>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <User size={16} color={Colors.verified} strokeWidth={2} />
                <Text style={styles.metricLabel}>Human Probability</Text>
              </View>
              <Text style={styles.metricSubtitle}>content-level</Text>
              <Text style={[styles.metricValue, { color: (metrics.humanProbability ?? 0) > 50 ? Colors.verified : Colors.unverified }]}>
                {metrics.humanProbability ?? 50}%
              </Text>
              <View style={styles.metricBar}>
                <View style={[styles.metricBarFill, { width: `${metrics.humanProbability ?? 50}%`, backgroundColor: (metrics.humanProbability ?? 0) > 50 ? Colors.verified : Colors.unverified }]} />
              </View>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <AlertTriangle size={16} color={Colors.unverified} strokeWidth={2} />
                <Text style={styles.metricLabel}>Manipulation Risk</Text>
              </View>
              <Text style={styles.metricSubtitle}>pattern-level</Text>
              <Text style={[styles.metricValue, { color: (metrics.manipulationRisk ?? 0) > 50 ? Colors.highRisk : Colors.verified }]}>
                {metrics.manipulationRisk ?? 50}%
              </Text>
              <View style={styles.metricBar}>
                <View style={[styles.metricBarFill, { width: `${metrics.manipulationRisk ?? 50}%`, backgroundColor: (metrics.manipulationRisk ?? 0) > 50 ? Colors.highRisk : Colors.verified }]} />
              </View>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <ShieldAlert size={16} color={Colors.highRisk} strokeWidth={2} />
                <Text style={styles.metricLabel}>Scam Indicators</Text>
              </View>
              <Text style={styles.metricSubtitle}>platform-level</Text>
              <Text style={[styles.metricValue, { color: (metrics.scamIndicators ?? 0) > 2 ? Colors.highRisk : Colors.verified }]}>
                {metrics.scamIndicators ?? 0}/10
              </Text>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
