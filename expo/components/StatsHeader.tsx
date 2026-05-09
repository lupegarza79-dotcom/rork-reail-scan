import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Eye, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors, { Fonts } from '@/constants/colors';
import { useAppState } from '@/providers/AppState';

export default function StatsHeader() {
  const router = useRouter();
  const { stats, watch } = useAppState();

  const isBeta = stats.scans === 0;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {isBeta ? (
          <View style={styles.betaPill} testID="beta-pill">
            <Sparkles size={11} color={Colors.info} strokeWidth={2.5} />
            <Text style={styles.betaText}>BETA</Text>
          </View>
        ) : (
          <View style={styles.statRow} testID="stats-counter">
            <Text style={styles.statNumber}>{stats.scans}</Text>
            <Text style={styles.statLabel}>scans</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={[styles.statNumber, { color: Colors.highRisk }]}>
              {stats.threatsBlocked}
            </Text>
            <Text style={styles.statLabel}>blocked</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => router.push('/watch' as never)}
        style={styles.watchBtn}
        activeOpacity={0.7}
        testID="watch-nav"
      >
        <Eye size={14} color={Colors.text} strokeWidth={2} />
        <Text style={styles.watchText}>Watch</Text>
        {watch.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{watch.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  left: {
    flex: 1,
  },
  betaPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.infoBg,
    borderColor: Colors.info,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  betaText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.info,
  },
  statRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  statNumber: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dot: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  watchBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
  },
  watchText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: Colors.highRisk,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: '#fff',
  },
});
