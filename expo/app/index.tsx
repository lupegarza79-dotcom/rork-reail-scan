import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  Animated,
  StatusBar,
  ScrollView,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, AlertCircle, ArrowRight, ShieldCheck, Zap, LockOpen } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors, { Fonts } from '@/constants/colors';
import { createShareLink, CreateShareResponse } from '@/utils/walletShare';
import { getRefToken } from '@/utils/tracking';
import StatsHeader from '@/components/StatsHeader';
import SocialProofLine from '@/components/SocialProofLine';
import ScanningView from '@/components/ScanningView';

const MIN_SCAN_MS = 2500;

const SAMPLES: { label: string; url: string }[] = [
  { label: 'github.com', url: 'https://github.com' },
  { label: 'paypal-secure-login.co', url: 'https://paypal-secure-login.co' },
  { label: 'apple.com', url: 'https://apple.com' },
];

function isValidUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return !!url.hostname && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function normalizeUrl(text: string): string {
  const trimmed = text.trim();
  if (trimmed.match(/^https?:\/\//)) return trimmed;
  return `https://${trimmed}`;
}

export default function LandingScreen() {
  const router = useRouter();
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanningUrl, setScanningUrl] = useState<string>('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const orbA = useRef(new Animated.Value(0)).current;
  const orbB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(val, { toValue: 0, duration, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        ])
      );
    const a = loop(breathe, 2400);
    const b = loop(orbA, 6000);
    const c = loop(orbB, 7500);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [breathe, orbA, orbB]);

  const scanMutation = useMutation<CreateShareResponse | null, Error, string>({
    mutationFn: async (inputUrl: string) => {
      const trimmed = inputUrl.trim();
      console.log('[Landing] Scanning:', trimmed);

      const normalized = normalizeUrl(trimmed);
      let parsed: URL;
      try {
        parsed = new URL(normalized);
      } catch (e) {
        console.log('[Landing] Invalid URL:', e);
        return null;
      }
      const fullUrl = parsed.toString();

      const minDelay = new Promise<void>((res) => setTimeout(res, MIN_SCAN_MS));
      const [data] = await Promise.all([createShareLink(fullUrl), minDelay]);

      if (!data?.token) {
        throw new Error('wallet-share failed');
      }
      return data;
    },

    onSuccess: (data) => {
      setScanning(false);
      if (!data) {
        console.log('[Landing] Scan stopped safely');
        return;
      }
      console.log('[Landing] Scan success, token:', data.token);
      setError('');
      router.push(`/s/${data.token}`);
    },

    onError: (err) => {
      setScanning(false);
      console.log('[Landing] Scan error:', err);
      setError('Unable to scan. Check the URL and try again.');
    },
  });

  useEffect(() => {
    return () => {
      setScanning(false);
    };
  }, []);

  const handleScan = useCallback(
    (override?: string) => {
      const target = (override ?? url).trim();
      Keyboard.dismiss();
      setError('');

      if (!target) {
        setError('Paste a link to scan.');
        return;
      }
      if (!isValidUrl(target)) {
        setError('Enter a valid URL.');
        return;
      }
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();

      getRefToken().then((ref) => {
        if (ref) console.log('SCAN FROM REF:', ref);
      });

      setScanningUrl(target);
      setScanning(true);
      if (override) setUrl(override);
      scanMutation.mutate(target);
    },
    [url, scanMutation, pulseAnim]
  );

  const isLoading = scanMutation.isPending;

  if (scanning) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safeArea}>
          <ScanningView url={scanningUrl} active={scanning} minDuration={MIN_SCAN_MS} />
        </SafeAreaView>
      </View>
    );
  }

  const breatheOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const orbATranslate = orbA.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] });
  const orbBTranslate = orbB.interpolate({ inputRange: [0, 1], outputRange: [25, -15] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Cinematic ambient atmosphere */}
      <View style={styles.atmosphere} pointerEvents="none">
        <LinearGradient
          colors={[ '#0B0B0F', '#0E0F18', '#0B0B0F' ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <Animated.View
          style={[
            styles.orb,
            styles.orbTop,
            { transform: [{ translateY: orbATranslate }], opacity: 0.55 },
          ]}
        >
          <LinearGradient
            colors={[ 'rgba(99,102,241,0.55)', 'rgba(99,102,241,0)' ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.orb,
            styles.orbBottom,
            { transform: [{ translateY: orbBTranslate }], opacity: 0.4 },
          ]}
        >
          <LinearGradient
            colors={[ 'rgba(16,185,129,0.4)', 'rgba(16,185,129,0)' ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
        <View style={styles.grain} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <StatsHeader />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.brandRing}>
                <View style={styles.brandDot} />
              </View>
              <Text style={styles.brand}>REAiL</Text>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>BETA</Text>
              </View>
            </View>

            <Text style={styles.title}>
              Scan any link{`\n`}
              <Text style={styles.titleAccent}>before you pay.</Text>
            </Text>

            <Text style={styles.tagline}>
              Before you click, pay, or trust — REAiL it.
            </Text>
          </View>

          <View style={styles.inputArea}>
            <View style={styles.inputWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.inputGlow,
                  { opacity: breatheOpacity, transform: [{ scale: breatheScale }] },
                ]}
              >
                <LinearGradient
                  colors={[ 'rgba(99,102,241,0.55)', 'rgba(16,185,129,0.35)' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
                <Search size={18} color={Colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="Paste link or text"
                  placeholderTextColor={Colors.textTertiary}
                  value={url}
                  onChangeText={(t) => {
                    setUrl(t);
                    if (error) setError('');
                  }}
                  onSubmitEditing={() => handleScan()}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  editable={!isLoading}
                  testID="url-input"
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <AlertCircle size={14} color={Colors.unverified} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.scanBtn, isLoading && styles.scanBtnDisabled]}
                onPress={() => handleScan()}
                activeOpacity={0.85}
                disabled={isLoading}
                testID="scan-btn"
              >
                <LinearGradient
                  colors={[ '#FFFFFF', '#E6E6EE' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {isLoading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <Text style={styles.scanBtnText}>REAiL it</Text>
                    <ArrowRight size={18} color="#09090B" strokeWidth={2.5} />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.trustPills}>
              <View style={styles.trustPill}>
                <LockOpen size={11} color={Colors.textSecondary} strokeWidth={2.2} />
                <Text style={styles.trustPillText}>No login</Text>
              </View>
              <View style={styles.trustPillDot} />
              <View style={styles.trustPill}>
                <ShieldCheck size={11} color={Colors.textSecondary} strokeWidth={2.2} />
                <Text style={styles.trustPillText}>Free scan</Text>
              </View>
              <View style={styles.trustPillDot} />
              <View style={styles.trustPill}>
                <Zap size={11} color={Colors.textSecondary} strokeWidth={2.2} />
                <Text style={styles.trustPillText}>Instant analysis</Text>
              </View>
            </View>
          </View>

          <View style={styles.samplesWrap}>
            <Text style={styles.samplesLabel}>TRY ON</Text>
            <View style={styles.samplesRow}>
              {SAMPLES.map((s) => (
                <TouchableOpacity
                  key={s.url}
                  style={styles.sampleChip}
                  onPress={() => handleScan(s.url)}
                  activeOpacity={0.7}
                  testID={`sample-${s.label}`}
                >
                  <Text style={styles.sampleText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <SocialProofLine />
          </View>
        </ScrollView>
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
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden' as const,
  },
  orb: {
    position: 'absolute' as const,
    width: 520,
    height: 520,
    borderRadius: 260,
    overflow: 'hidden' as const,
  },
  orbTop: {
    top: -200,
    left: -120,
  },
  orbBottom: {
    bottom: -240,
    right: -160,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,11,15,0.35)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  hero: {
    alignItems: 'center' as const,
    marginBottom: 32,
    gap: 16,
  },
  brandRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  brandRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.verified,
    shadowColor: Colors.verified,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  brand: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  brandBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    marginLeft: 2,
  },
  brandBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: '#A5B4FC',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 40,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -1.6,
    lineHeight: 46,
    textAlign: 'center' as const,
    marginTop: 6,
  },
  titleAccent: {
    color: '#C7CCFF',
    fontStyle: 'italic' as const,
    fontFamily: Fonts.serifItalic,
    fontWeight: '400' as const,
    letterSpacing: -0.8,
  },
  tagline: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 2,
    paddingHorizontal: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  inputArea: {
    gap: 14,
  },
  inputWrap: {
    position: 'relative' as const,
  },
  inputGlow: {
    position: 'absolute' as const,
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 22,
    overflow: 'hidden' as const,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(20,20,28,0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    height: 68,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  inputRowError: {
    borderColor: Colors.unverified,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
    height: '100%' as unknown as number,
  },
  errorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.unverified,
    letterSpacing: -0.1,
  },
  scanBtn: {
    flexDirection: 'row' as const,
    height: 60,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    overflow: 'hidden' as const,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  trustPills: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap' as const,
  },
  trustPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  trustPillText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  trustPillDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },
  scanBtnDisabled: {
    opacity: 0.7,
  },
  scanBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#09090B',
    letterSpacing: -0.2,
  },
  samplesWrap: {
    marginTop: 26,
    alignItems: 'center' as const,
    gap: 10,
  },
  samplesLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textTertiary,
  },
  samplesRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'center' as const,
  },
  sampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 999,
  },
  sampleText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 22,
    gap: 6,
  },
});
