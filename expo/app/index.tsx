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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Search, AlertCircle } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { createShareLink } from '@/utils/walletShare';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shieldGlow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shieldGlow, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shieldGlow, {
          toValue: 0.4,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shieldGlow]);

  const scanMutation = useMutation({
    mutationFn: async (inputUrl: string) => {
      console.log('[Landing] Scanning:', inputUrl);
      const normalized = normalizeUrl(inputUrl);
      const result = await createShareLink(normalized);
      if (!result) {
        throw new Error('Scan failed');
      }
      return result;
    },
    onSuccess: (data) => {
      console.log('[Landing] Scan success, token:', data.token);
      setError('');
      router.push(`/s/${data.token}`);
    },
    onError: (err) => {
      console.log('[Landing] Scan error:', err);
      setError('Unable to scan. Check the URL and try again.');
    },
  });

  const handleScan = useCallback(() => {
    Keyboard.dismiss();
    setError('');

    if (!url.trim()) {
      setError('Paste a link to scan.');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Enter a valid URL.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    scanMutation.mutate(url);
  }, [url, scanMutation, pulseAnim]);

  const isLoading = scanMutation.isPending;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.hero}>
            <Animated.View style={[styles.shieldWrap, { opacity: shieldGlow }]}>
              <Shield size={48} color={Colors.highRisk} strokeWidth={2} />
            </Animated.View>
            <Text style={styles.title}>REAiL</Text>
            <Text style={styles.subtitle}>Wallet Shield</Text>
            <Text style={styles.tagline}>Paste link. Know before you pay.</Text>
          </View>

          <View style={styles.inputArea}>
            <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
              <Search size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="Paste any link here…"
                placeholderTextColor={Colors.textTertiary}
                value={url}
                onChangeText={(t) => {
                  setUrl(t);
                  if (error) setError('');
                }}
                onSubmitEditing={handleScan}
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
                <AlertCircle size={14} color={Colors.highRisk} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.scanBtn, isLoading && styles.scanBtnDisabled]}
                onPress={handleScan}
                activeOpacity={0.85}
                disabled={isLoading}
                testID="scan-btn"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.scanBtnText}>Scan</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>No login. No app needed. Just paste.</Text>
          </View>
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
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center' as const,
    marginBottom: 48,
  },
  shieldWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '900' as const,
    color: Colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.highRisk,
    letterSpacing: 1,
    marginTop: 4,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  inputArea: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 56,
    gap: 10,
  },
  inputRowError: {
    borderColor: Colors.highRisk,
  },
  input: {
    flex: 1,
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
    fontSize: 13,
    color: Colors.highRisk,
  },
  scanBtn: {
    backgroundColor: Colors.highRisk,
    height: 56,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  scanBtnDisabled: {
    opacity: 0.7,
  },
  scanBtnText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: 'white',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 48,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
