import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { generateMockScan } from '@/utils/mockScan';
import Logo from '@/components/Logo';

const SCAN_STEPS = [
  { key: 'media', labelKey: 'checkMedia' as const },
  { key: 'claims', labelKey: 'checkClaims' as const },
  { key: 'source', labelKey: 'checkSource' as const },
  { key: 'link', labelKey: 'checkLink' as const },
];

export default function ScanningScreen() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url: string }>();
  const { t, setCurrentScan, addScan } = useApp();
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim, glowAnim, rotateAnim]);

  useEffect(() => {
    const stepDuration = 800;
    
    SCAN_STEPS.forEach((_, index) => {
      setTimeout(() => {
        setCompletedSteps(index + 1);
        Animated.timing(progressAnim, {
          toValue: (index + 1) / SCAN_STEPS.length,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }, (index + 1) * stepDuration);
    });

    const totalTime = SCAN_STEPS.length * stepDuration + 500;
    setTimeout(() => {
      const scanResult = generateMockScan(url || 'https://example.com');
      setCurrentScan(scanResult);
      addScan(scanResult);
      router.replace('/result');
    }, totalTime);
  }, [url, setCurrentScan, addScan, router, progressAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Logo size="medium" showSubtext />

          <View style={styles.loaderContainer}>
            <View style={styles.scannerOuter}>
              <Animated.View 
                style={[
                  styles.scannerRing,
                  { 
                    transform: [{ rotate }, { scale: pulseAnim }],
                    opacity: glowAnim,
                  }
                ]}
              />
              <Animated.View 
                style={[
                  styles.scannerRingInner,
                  { 
                    transform: [{ rotate: rotate }, { scale: Animated.add(pulseAnim, -0.1) }],
                  }
                ]}
              />
              <View style={styles.scannerCenter}>
                <Shield size={32} color={Colors.primary} />
              </View>
            </View>
          </View>

          <Text style={styles.title}>{t.scanning}</Text>

          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.stepsContainer}>
            {SCAN_STEPS.map((step, index) => {
              const isCompleted = index < completedSteps;
              const isActive = index === completedSteps;
              
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={[
                    styles.stepIndicator,
                    isCompleted && styles.stepIndicatorComplete,
                    isActive && styles.stepIndicatorActive,
                  ]}>
                    {isCompleted ? (
                      <Check size={14} color={Colors.text} />
                    ) : (
                      <View style={[
                        styles.stepDot,
                        isActive && styles.stepDotActive,
                      ]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepText,
                    isCompleted && styles.stepTextComplete,
                    isActive && styles.stepTextActive,
                  ]}>
                    {t[step.labelKey]}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.microcopy}>{t.scanMicro}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderContainer: {
    marginTop: 48,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerOuter: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.primary,
    borderTopColor: 'transparent',
    borderRightColor: Colors.primary + '60',
  },
  scannerRingInner: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: Colors.accent + '40',
    borderBottomColor: 'transparent',
  },
  scannerCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 24,
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 3,
    marginBottom: 40,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  stepsContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
    marginBottom: 40,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorComplete: {
    backgroundColor: Colors.verified,
    shadowColor: Colors.verified,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  stepIndicatorActive: {
    backgroundColor: Colors.primary,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },
  stepDotActive: {
    backgroundColor: Colors.text,
  },
  stepText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  stepTextComplete: {
    color: Colors.verified,
  },
  stepTextActive: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  microcopy: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});
