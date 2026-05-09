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
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, AlertCircle, X } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Colors, { Fonts } from '@/constants/colors';
import { createShareLink, CreateShareResponse } from '@/utils/walletShare';
import { getRefToken } from '@/utils/tracking';
import StatsHeader from '@/components/StatsHeader';
import SocialProofLine from '@/components/SocialProofLine';
import ScanningView from '@/components/ScanningView';

const MIN_SCAN_MS = 2500;

const PALETTE = {
  bg: '#000000',
  bgInput: '#2C2C2E',
  bgCard: '#1C1C1E',
  border: '#2C2C2E',
  blue: '#3A7BFF',
  text: '#FFFFFF',
  textSub: '#8E8E93',
  textDim: '#48484A',
} as const;

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

function ShieldIcon({ size = 56, color = PALETTE.blue }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <Path
        d="M26 4L8 11v13c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V11L26 4z"
        fill={color}
        fillOpacity={0.12}
      />
      <Path
        d="M26 4L8 11v13c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V11L26 4z"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanningUrl, setScanningUrl] = useState<string>('');
  const [focused, setFocused] = useState<boolean>(false);
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
        Animated.timing(pulseAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
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
  const canScan = url.trim().length > 0;

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
            <ShieldIcon size={56} color={PALETTE.blue} />
            <Text style={styles.brand}>REAiL</Text>
            <Text style={styles.brandSub}>Wallet Shield</Text>
            <Text style={styles.tagline}>Scan any link before you pay.</Text>
          </View>

          <View style={styles.inputArea}>
            <View
              style={[
                styles.inputRow,
                focused && styles.inputRowFocused,
                error ? styles.inputRowError : null,
              ]}
            >
              <Search size={16} color={PALETTE.textSub} strokeWidth={2} />
              <TextInput
                style={styles.input}
                placeholder="Paste link"
                placeholderTextColor={PALETTE.textSub}
                value={url}
                onChangeText={(t) => {
                  setUrl(t);
                  if (error) setError('');
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={() => handleScan()}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                editable={!isLoading}
                testID="url-input"
              />
              {url.length > 0 && !isLoading ? (
                <TouchableOpacity
                  onPress={() => {
                    setUrl('');
                    setError('');
                  }}
                  hitSlop={10}
                  testID="clear-input"
                >
                  <X size={16} color={PALETTE.textSub} strokeWidth={2} />
                </TouchableOpacity>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <AlertCircle size={13} color={Colors.unverified} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.scanBtn,
                  (!canScan || isLoading) && styles.scanBtnDisabled,
                ]}
                onPress={() => handleScan()}
                activeOpacity={0.85}
                disabled={isLoading}
                testID="scan-btn"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={PALETTE.text} />
                ) : (
                  <Text style={styles.scanBtnText}>Scan</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
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
            <Text style={styles.footerLine}>
              REAiL Wallet Shield · No login. Just paste.
            </Text>
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
    backgroundColor: PALETTE.bg,
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
    paddingBottom: 32,
    paddingTop: 8,
  },
  hero: {
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  brand: {
    fontFamily: Fonts.sansBold,
    fontSize: 32,
    fontWeight: '800' as const,
    color: PALETTE.text,
    letterSpacing: -0.5,
    marginTop: 16,
  },
  brandSub: {
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
    fontWeight: '500' as const,
    color: PALETTE.blue,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  tagline: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: PALETTE.textSub,
    textAlign: 'center' as const,
    marginTop: 8,
    letterSpacing: -0.1,
  },
  inputArea: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: PALETTE.bgInput,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    height: 54,
    gap: 10,
  },
  inputRowFocused: {
    borderColor: PALETTE.blue,
  },
  inputRowError: {
    borderColor: Colors.unverified,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: PALETTE.text,
    letterSpacing: -0.2,
    height: '100%' as unknown as number,
    padding: 0,
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
    height: 54,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: PALETTE.blue,
    marginTop: 4,
  },
  scanBtnDisabled: {
    opacity: 0.5,
  },
  scanBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    fontWeight: '700' as const,
    color: PALETTE.text,
    letterSpacing: -0.2,
  },
  samplesWrap: {
    marginTop: 28,
    alignItems: 'center' as const,
    gap: 10,
  },
  samplesLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 2,
    color: PALETTE.textDim,
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
    backgroundColor: PALETTE.bgCard,
    borderColor: PALETTE.border,
    borderWidth: 1,
    borderRadius: 999,
  },
  sampleText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: PALETTE.textSub,
    letterSpacing: -0.1,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 28,
    gap: 10,
  },
  footerLine: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: PALETTE.textSub,
    letterSpacing: -0.1,
    textAlign: 'center' as const,
  },
});
