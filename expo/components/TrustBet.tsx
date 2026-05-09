import React, { useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Brain, ShieldX, ShieldCheck } from 'lucide-react-native';
import Colors, { Fonts } from '@/constants/colors';

export interface TrustBetProps {
  domain: string;
  onSelect: (prediction: 'real' | 'fake') => void;
}

export default function TrustBet({ domain, onSelect }: TrustBetProps) {
  const realScale = useRef(new Animated.Value(1)).current;
  const fakeScale = useRef(new Animated.Value(1)).current;

  const press = (scale: Animated.Value, value: 'real' | 'fake') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => onSelect(value));
  };

  return (
    <View style={styles.wrap} testID="trust-bet">
      <View style={styles.tagRow}>
        <Brain size={12} color={Colors.info} strokeWidth={2.5} />
        <Text style={styles.tag}>TRUST BET · GUT CHECK</Text>
      </View>

      <Text style={styles.headline}>What does your instinct say?</Text>
      <Text style={styles.subhead} numberOfLines={1}>
        {domain}
      </Text>

      <View style={styles.row}>
        <Animated.View style={{ flex: 1, transform: [{ scale: realScale }] }}>
          <TouchableOpacity
            style={[styles.choice, styles.choiceReal]}
            onPress={() => press(realScale, 'real')}
            activeOpacity={0.85}
            testID="bet-real"
          >
            <ShieldCheck size={22} color={Colors.verified} strokeWidth={2.2} />
            <Text style={[styles.choiceLabel, { color: Colors.verified }]}>REAL</Text>
            <Text style={styles.choiceHint}>Looks legit</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ flex: 1, transform: [{ scale: fakeScale }] }}>
          <TouchableOpacity
            style={[styles.choice, styles.choiceFake]}
            onPress={() => press(fakeScale, 'fake')}
            activeOpacity={0.85}
            testID="bet-fake"
          >
            <ShieldX size={22} color={Colors.highRisk} strokeWidth={2.2} />
            <Text style={[styles.choiceLabel, { color: Colors.highRisk }]}>FAKE</Text>
            <Text style={styles.choiceHint}>Smells off</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Text style={styles.disclaimer}>Not gambling. Trains your fraud instinct.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 16,
    alignItems: 'center' as const,
  },
  tagRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.infoBg,
    borderColor: Colors.info,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tag: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.info,
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center' as const,
    lineHeight: 32,
  },
  subhead: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  row: {
    flexDirection: 'row' as const,
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  choice: {
    height: 132,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 8,
  },
  choiceReal: {
    borderColor: Colors.verified,
  },
  choiceFake: {
    borderColor: Colors.highRisk,
  },
  choiceLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 18,
    letterSpacing: 2,
  },
  choiceHint: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  disclaimer: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    marginTop: 8,
  },
});
