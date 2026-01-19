import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Shield, Wifi, WifiOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { scanService } from '@/utils/scanService';
import Logo from '@/components/Logo';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useNetwork } from '@/hooks/useNetwork';

const SCAN_STEPS = [
  { key: 'media', labelKey: 'checkMedia' as const },
  { key: 'claims', labelKey: 'checkClaims' as const },
  { key: 'source', labelKey: 'checkSource' as const },
  { key: 'link', labelKey: 'checkLink' as const },
];

const PULSE_DURATION = 1600;
const ROTATION_DURATION = 3000;
const STEP_DURATION = 800;

export default function ScanningScreen() {
  const router = useRouter();
  const { url, mediaUri } = useLocalSearchParams<{ url?: string; mediaUri?: string }>();
  const { t, setCurrentScan, addScan, recordScan } = useApp();
  const reduceMotion = useReduceMotion();
  const { isConnected } = useNetwork();
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [, setIsScanning] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.35)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.5);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: PULSE_DURATION / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: PULSE_DURATION / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: PULSE_DURATION / 2,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.35,
            duration: PULSE_DURATION / 2,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseAnimation.start();

    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: ROTATION_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotateAnimation.stop();
    };
  }, [pulseAnim, glowAnim, rotateAnim, reduceMotion]);

  useEffect(() => {
    const performScan = async () => {
      const timeouts: ReturnType<typeof setTimeout>[] = [];
      
      SCAN_STEPS.forEach((_, index) => {
        const timeout = setTimeout(() => {
          setCompletedSteps(index + 1);
          if (!reduceMotion) {
            Animated.timing(progressAnim, {
              toValue: (index + 1) / SCAN_STEPS.length,
              duration: 300,
              useNativeDriver: false,
            }).start();
          } else {
            progressAnim.setValue((index + 1) / SCAN_STEPS.length);
          }
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }, (index + 1) * STEP_DURATION);
        timeouts.push(timeout);
      });

      try {
        console.log('[ScanningScreen] Starting AI-powered scan...');
        
        let scanResult;
        if (mediaUri) {
          console.log('[ScanningScreen] Scanning media:', mediaUri);
          scanResult = await scanService.scanMedia({ mediaUri });
        } else if (url) {
          console.log('[ScanningScreen] Scanning URL:', url);
          scanResult = await scanService.scanUrl({ url });
        } else {
          throw new Error('No URL or media provided');
        }
        
        const minWaitTime = SCAN_STEPS.length * STEP_DURATION + 500;
        await new Promise(resolve => setTimeout(resolve, minWaitTime));
        
        recordScan();
        setCurrentScan(scanResult);
        addScan(scanResult);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        console.log('[ScanningScreen] Scan complete:', scanResult.badge, scanResult.score);
        router.replace('/result');
      } catch (error) {
        console.error('[ScanningScreen] Scan error:', error);
        setScanError('Scan failed. Please try again.');
        setIsScanning(false);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
      
      return () => {
        timeouts.forEach(clearTimeout);
      };
    };
    
    performScan();
  }, [url, mediaUri, setCurrentScan, addScan, router, progressAnim, reduceMotion, recordScan]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (scanError) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.background, Colors.backgroundSecondary, Colors.background]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContent}>
            <WifiOff size={48} color={Colors.highRisk} />
            <Text style={styles.errorTitle}>{scanError}</Text>
            <Text style={styles.errorSubtext}>
              {!isConnected ? 'Check your internet connection' : 'Please try again'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundSecondary, Colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.networkStatus}>
            {isConnected ? (
              <Wifi size={16} color={Colors.verified} />
            ) : (
              <WifiOff size={16} color={Colors.highRisk} />
            )}
            <Text style={[styles.networkText, !isConnected && styles.networkTextOffline]}>
              {isConnected ? 'AI Engine Connected' : 'Offline Mode'}
            </Text>
          </View>
          
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
  errorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.highRisk,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.verified,
  },
  networkTextOffline: {
    color: Colors.highRisk,
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
