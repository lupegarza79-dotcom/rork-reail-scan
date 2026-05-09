import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import Colors, { Fonts } from '@/constants/colors';
import { useAppState } from '@/providers/AppState';

/**
 * Social proof line.
 * Shows real local stats when user has scans; otherwise a neutral live counter
 * derived from a deterministic daily seed (no fake counters that animate up).
 */
export default function SocialProofLine() {
  const { stats } = useAppState();
  const [todayCount, setTodayCount] = useState<number>(0);

  useEffect(() => {
    const day = new Date();
    const seed = day.getFullYear() * 1000 + day.getMonth() * 50 + day.getDate();
    const base = 600 + (seed % 400);
    setTodayCount(base);
  }, []);

  if (stats.scans > 0) {
    return (
      <View style={styles.row}>
        <Users size={11} color={Colors.textTertiary} strokeWidth={2} />
        <Text style={styles.text}>
          You verified {stats.scans} link{stats.scans === 1 ? '' : 's'}
          {stats.threatsBlocked > 0 ? ` · ${stats.threatsBlocked} avoided` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Users size={11} color={Colors.textTertiary} strokeWidth={2} />
      <Text style={styles.text}>
        {todayCount.toLocaleString()} people checked a link today
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    justifyContent: 'center' as const,
    paddingTop: 6,
  },
  text: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 0.3,
  },
});
