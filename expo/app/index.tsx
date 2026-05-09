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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, AlertCircle, Sparkles, ArrowRight, ShieldCheck, Zap, LockOpen } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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

      // Run network and minimum animation in parallel
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <StatsHeader />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.kicker}>
              <Sparkles size={11} color={Colors.info} strokeWidth={2.5} />
              <Text style={styles.kickerText}>SCAN ANY LINK BEFORE YOU PAY</Text>
            </View>
            <Text style={styles.title}>REAiL</Text>
            <Text style={styles.tagline}>
              Before you click, pay, or trust — <Text style={styles.taglineEm}>REAiL it.</Text>
            </Text>
          </View>

          <View style={styles.inputArea}>
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
    marginBottom: 22,
    gap: 8,
  },
  kicker: {
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
  kickerText: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.info,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 56,
    color: Colors.text,
    letterSpacing: -1,
    lineHeight: 60,
    marginTop: 2,
  },
  tagline: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 2,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  taglineEm: {
    color: Colors.text,
    fontFamily: Fonts.monoBold,
  },
  inputArea: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 16,
    height: 64,
    gap: 12,
  },
  inputRowError: {
    borderColor: Colors.unverified,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    height: '100%' as unknown as number,
  },
  errorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.unverified,
  },
  scanBtn: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.text,
    height: 60,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
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
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
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
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: '#09090B',
    letterSpacing: 1,
  },
  samplesWrap: {
    marginTop: 18,
    alignItems: 'center' as const,
    gap: 8,
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
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  sampleText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 22,
    gap: 6,
  },
  footerText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
});
