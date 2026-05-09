import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Globe, Lock, Search, ShieldCheck, Zap } from 'lucide-react-native';
import Colors, { Fonts } from '@/constants/colors';

interface Step {
  key: string;
  label: string;
  Icon: typeof Globe;
}

const STEPS: Step[] = [
  { key: 'resolve', label: 'Resolving target', Icon: Globe },
  { key: 'cert', label: 'Inspecting certificate', Icon: Lock },
  { key: 'intel', label: 'Cross-checking threat intel', Icon: Search },
  { key: 'pattern', label: 'Pattern & content analysis', Icon: Zap },
  { key: 'verdict', label: 'Composing verdict', Icon: ShieldCheck },
];

export interface ScanningViewProps {
  url: string;
  active: boolean;
  /** total minimum duration in ms (will not finish before this) */
  minDuration?: number;
}

export default function ScanningView({ url, active, minDuration = 2500 }: ScanningViewProps) {
  const [stepIndex, setStepIndex] = useState<number>(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    setStepIndex(0);
    const perStep = Math.max(400, Math.floor(minDuration / STEPS.length));
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setStepIndex(i), perStep * i));
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [active, minDuration]);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    sweepLoop.start();
    return () => {
      loop.stop();
      sweepLoop.stop();
      sweep.setValue(0);
    };
  }, [active, pulse, sweep]);

  if (!active) return null;

  const sweepTranslate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 160],
  });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  const ActiveIcon = STEPS[stepIndex].Icon;

  return (
    <View style={styles.wrap}>
      <View style={styles.coreCol}>
        <View style={styles.haloWrap}>
          <Animated.View
            style={[
              styles.halo,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <View style={styles.coreCircle}>
            <ActiveIcon size={28} color={Colors.text} strokeWidth={2} />
            <Animated.View
              style={[
                styles.sweepBar,
                { transform: [{ translateX: sweepTranslate }] },
              ]}
            />
          </View>
        </View>

        <Text style={styles.scanningLabel}>SCANNING</Text>
        <Text style={styles.urlText} numberOfLines={1}>
          {url}
        </Text>
      </View>

      <View style={styles.steps}>
        {STEPS.map((s, i) => {
          const Icon = s.Icon;
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
          const color =
            state === 'done'
              ? Colors.verified
              : state === 'active'
              ? Colors.text
              : Colors.textTertiary;
          return (
            <View key={s.key} style={styles.stepRow}>
              <Icon size={14} color={color} strokeWidth={2} />
              <Text style={[styles.stepLabel, { color }]}>{s.label}</Text>
              {state === 'active' && <View style={styles.activeDot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 32,
  },
  coreCol: {
    alignItems: 'center' as const,
    gap: 12,
  },
  haloWrap: {
    width: 140,
    height: 140,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  halo: {
    position: 'absolute' as const,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: Colors.info,
    backgroundColor: Colors.infoBg,
  },
  coreCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  sweepBar: {
    position: 'absolute' as const,
    width: 80,
    height: 84,
    backgroundColor: 'rgba(96, 165, 250, 0.18)',
  },
  scanningLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.info,
    marginTop: 4,
  },
  urlText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
    maxWidth: 280,
  },
  steps: {
    gap: 10,
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  stepLabel: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    flex: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.info,
  },
});
