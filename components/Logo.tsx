import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/colors';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showSubtext?: boolean;
}

export default function Logo({ size = 'medium', showSubtext = false }: LogoProps) {
  const fontSize = size === 'small' ? 18 : size === 'medium' ? 24 : 36;
  const iOffset = size === 'small' ? 2 : size === 'medium' ? 3 : 4;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.wordmark}>
        <Text style={[styles.text, { fontSize }]}>REA</Text>
        <View style={styles.accentContainer}>
          <Animated.Text 
            style={[
              styles.accent, 
              { 
                fontSize, 
                marginTop: iOffset,
                opacity: glowAnim,
              }
            ]}
          >
            i
          </Animated.Text>
          <View style={[styles.glowDot, { top: iOffset + fontSize * 0.15 }]} />
        </View>
        <Text style={[styles.text, { fontSize }]}>L</Text>
      </View>
      {showSubtext && (
        <Text style={styles.subtext}>Reality Verification</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 1,
  },
  accentContainer: {
    position: 'relative',
  },
  accent: {
    fontWeight: '600' as const,
    color: Colors.accent,
    letterSpacing: 1,
    textShadowColor: Colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  glowDot: {
    position: 'absolute',
    left: '50%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginLeft: -2,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  subtext: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
