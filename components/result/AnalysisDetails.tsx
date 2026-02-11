import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronDown,
  ChevronRight,
  Video,
  Copy,
  MessageSquare,
  UserCheck,
  LinkIcon,
  Zap,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { styles } from './resultStyles';

type ReasonKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

type Reason = {
  title: string;
  summary: string;
  details?: string[];
  whatWouldVerify?: string[];
};

interface Props {
  reasonsMerged: Record<ReasonKey, Reason>;
  sortedReasonKeys: ReasonKey[];
}

const REASON_ICONS: Record<ReasonKey, React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  A: Video,
  B: Copy,
  C: MessageSquare,
  D: UserCheck,
  E: LinkIcon,
  F: Zap,
};

export default function AnalysisDetails({ reasonsMerged, sortedReasonKeys }: Props) {
  const [expanded, setExpanded] = useState<Record<ReasonKey, boolean>>({
    A: false, B: false, C: false, D: false, E: false, F: false,
  });

  const toggleExpand = useCallback((k: ReasonKey) => {
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  return (
    <View style={styles.reasonsSection}>
      <Text style={styles.sectionTitle}>Analysis Details</Text>
      <Text style={styles.sectionSubtitle}>Tap to expand each category</Text>

      {sortedReasonKeys.map((k) => {
        const item = reasonsMerged[k];
        const isOpen = expanded[k];
        const hasDetails = (item.details?.length ?? 0) > 0;
        const IconComponent = REASON_ICONS[k];

        return (
          <Pressable
            key={k}
            onPress={() => toggleExpand(k)}
            style={({ pressed }) => [
              styles.reasonCard,
              hasDetails && styles.reasonCardHighlighted,
              pressed && styles.reasonCardPressed,
            ]}
          >
            <View style={styles.reasonHeader}>
              <View style={[styles.reasonKeyBadge, hasDetails && styles.reasonKeyBadgeHighlighted]}>
                <IconComponent size={16} color={hasDetails ? Colors.accent : Colors.textTertiary} strokeWidth={2} />
              </View>
              <View style={styles.reasonContentWrapper}>
                <Text style={styles.reasonTitle}>{item.title}</Text>
                <Text style={styles.reasonSummary}>{item.summary}</Text>
              </View>
              {isOpen
                ? <ChevronDown size={20} color={Colors.textTertiary} strokeWidth={2} />
                : <ChevronRight size={20} color={Colors.textTertiary} strokeWidth={2} />}
            </View>

            {isOpen && (
              <View style={styles.reasonBody}>
                {!!item.details?.length && (
                  <View style={styles.reasonDetailsSection}>
                    <Text style={styles.reasonBodyTitle}>Details</Text>
                    {item.details.map((d, i) => (
                      <Text key={i} style={styles.reasonBullet}>• {d}</Text>
                    ))}
                  </View>
                )}
                {!!item.whatWouldVerify?.length && (
                  <View style={styles.reasonDetailsSection}>
                    <Text style={styles.reasonBodyTitle}>What would verify this?</Text>
                    {item.whatWouldVerify.map((d, i) => (
                      <Text key={i} style={styles.reasonBullet}>• {d}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
