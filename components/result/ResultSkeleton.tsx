import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import Colors from '@/constants/colors';

function Shimmer({ width, height, radius = 8 }: { width: number | string; height: number; radius?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        width: width as number,
        height,
        borderRadius: radius,
        backgroundColor: Colors.shimmer,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
      }}
    />
  );
}

export default function ResultSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.center}>
          <Shimmer width={88} height={88} radius={44} />
          <View style={styles.gap12} />
          <Shimmer width={120} height={24} radius={12} />
          <View style={styles.gap8} />
          <Shimmer width={160} height={14} />
        </View>
        <View style={styles.scoreRow}>
          <Shimmer width={80} height={80} radius={40} />
          <View style={styles.scoreBars}>
            <Shimmer width={200} height={8} radius={4} />
            <View style={styles.gap8} />
            <Shimmer width={120} height={12} />
          </View>
        </View>
        <Shimmer width={260} height={40} radius={12} />
      </View>

      <View style={styles.nbaCard}>
        <Shimmer width={200} height={20} />
        <View style={styles.gap10} />
        <Shimmer width={260} height={14} />
        <View style={styles.gap6} />
        <Shimmer width={220} height={14} />
        <View style={styles.gap16} />
        <View style={styles.btnRow}>
          <Shimmer width={140} height={44} radius={12} />
          <Shimmer width={140} height={44} radius={12} />
        </View>
      </View>

      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.evidenceCard}>
          <View style={styles.evidenceRow}>
            <Shimmer width={36} height={36} radius={10} />
            <View style={styles.evidenceContent}>
              <Shimmer width={120} height={14} />
              <View style={styles.gap6} />
              <Shimmer width={200} height={12} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 20,
  },
  center: { alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreBars: { flex: 1 },
  nbaCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  evidenceCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  evidenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  evidenceContent: { flex: 1 },
  gap6: { height: 6 },
  gap8: { height: 8 },
  gap10: { height: 10 },
  gap12: { height: 12 },
  gap16: { height: 16 },
});
