import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldOff,
  ShieldAlert,
  ShieldCheck,
  Share2,
  DollarSign,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  OctagonAlert,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { resolveShareLink, WalletShareData } from '@/utils/walletShare';
import type { BadgeType } from '@/types/scan';

type Verdict = 'STOP' | 'CAUTION' | 'OK';

interface VerdictConfig {
  verdict: Verdict;
  emoji: string;
  headlineEn: string;
  headlineEs: string;
  color: string;
  bg: string;
  badgeLabelEn: string;
  badgeLabelEs: string;
  Icon: typeof ShieldOff;
}

const VERDICT_MAP: Record<Verdict, VerdictConfig> = {
  STOP: {
    verdict: 'STOP',
    emoji: '🛑',
    headlineEn: 'STOP PAYING',
    headlineEs: 'NO PAGUES',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    badgeLabelEn: 'HIGH RISK',
    badgeLabelEs: 'ALTO RIESGO',
    Icon: ShieldOff,
  },
  CAUTION: {
    verdict: 'CAUTION',
    emoji: '⚠️',
    headlineEn: 'CAUTION',
    headlineEs: 'PRECAUCIÓN',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    badgeLabelEn: 'CAUTION',
    badgeLabelEs: 'PRECAUCIÓN',
    Icon: ShieldAlert,
  },
  OK: {
    verdict: 'OK',
    emoji: '✅',
    headlineEn: 'OK TO PROCEED',
    headlineEs: 'SEGURO',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
    badgeLabelEn: 'OK',
    badgeLabelEs: 'OK',
    Icon: ShieldCheck,
  },
};

function computeVerdict(data: WalletShareData): Verdict {
  const score = data.score ?? 50;
  const badge = data.badge;

  if (score <= 35) return 'STOP';
  if (badge === 'HIGH_RISK' || badge === 'UNVERIFIED') return 'STOP';
  if (score >= 70 && badge === 'VERIFIED') return 'OK';
  if (score >= 36 && score <= 69) return 'CAUTION';
  return 'CAUTION';
}

function detectLocale(): 'en' | 'es' {
  if (Platform.OS === 'web') {
    try {
      const lang = navigator.language || '';
      if (lang.startsWith('es')) return 'es';
    } catch {}
  }
  return 'en';
}

export default function WalletShieldScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [locale, setLocale] = useState<'en' | 'es'>(detectLocale);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  const isEs = locale === 'es';

  const { data, isLoading, error, refetch } = useQuery<WalletShareData | null>({
    queryKey: ['share-link', token],
    queryFn: () => resolveShareLink(token || ''),
    enabled: !!token,
    staleTime: 30000,
  });

  const verdict = useMemo(() => (data ? computeVerdict(data) : null), [data]);
  const config = verdict ? VERDICT_MAP[verdict] : null;

  useEffect(() => {
    if (verdict === 'STOP') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [verdict, pulseAnim]);

  useEffect(() => {
    if (Platform.OS === 'web' && data && config) {
      document.title = `${config.emoji} ${config.headlineEn} — REAiL Scan`;

      const setMeta = (property: string, content: string) => {
        let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.content = content;
      };

      const ogTitle = verdict === 'STOP'
        ? '🛑 STOP PAYING — REAiL Scan'
        : verdict === 'CAUTION'
        ? '⚠️ CAUTION — REAiL Scan'
        : '✅ OK TO PROCEED — REAiL Scan';

      const ogDesc = verdict === 'STOP'
        ? 'High risk signals detected. Scan before you pay.'
        : verdict === 'CAUTION'
        ? 'Some concerns detected. Review before proceeding.'
        : 'This link appears safe based on available signals.';

      setMeta('og:title', ogTitle);
      setMeta('og:description', ogDesc);
      setMeta('og:type', 'website');
      setMeta('og:url', window.location.href);
      setMeta('og:image', 'https://reail.app/og/default-share.png');
    }
  }, [data, config, verdict]);

  const reasons = useMemo(() => {
    if (!data?.top_red_flags) return [];
    return data.top_red_flags.slice(0, 3);
  }, [data?.top_red_flags]);

  const actionText = useMemo(() => {
    if (!data) return '';
    if (data.next_action) return data.next_action;
    if (verdict === 'STOP') {
      return isEs
        ? 'No envíes dinero ni compartas información personal.'
        : 'Do not send money or share personal information.';
    }
    if (verdict === 'CAUTION') {
      return isEs
        ? 'Investiga más antes de proceder.'
        : 'Research further before proceeding.';
    }
    return isEs
      ? 'No se detectaron señales de riesgo significativas.'
      : 'No significant risk signals detected.';
  }, [data, verdict, isEs]);

  const handleShare = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const shareUrl = Platform.OS === 'web'
      ? window.location.href
      : `https://reail.app/s/${token}`;

    const shareEmoji = verdict === 'STOP' ? '🛑' : verdict === 'CAUTION' ? '⚠️' : '✅';
    const message = isEs
      ? `${shareEmoji} REAiL detectó riesgo en este enlace. Revisa antes de pagar: ${shareUrl}`
      : `${shareEmoji} REAiL detected risk in this link. Check before you pay: ${shareUrl}`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: '🛑 STOP PAYING — REAiL', text: message, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(message);
        }
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      console.log('[Shield] Share error:', err);
    }
  }, [token, verdict, isEs]);

  const handleAlreadyPaid = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    router.push({
      pathname: '/s/[token]/refund',
      params: { token: token || '', locale },
    } as any);
  }, [token, locale, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {isEs ? 'Escaneando...' : 'Scanning...'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !data || !config || !verdict) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <OctagonAlert size={56} color={Colors.highRisk} />
            <Text style={styles.errorTitle}>
              {isEs ? 'Enlace no encontrado' : 'Link Not Found'}
            </Text>
            <Text style={styles.errorSub}>
              {isEs ? 'Puede haber expirado.' : 'It may have expired.'}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} testID="retry-btn">
              <RefreshCw size={18} color="white" />
              <Text style={styles.retryText}>{isEs ? 'Reintentar' : 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const VerdictIcon = config.Icon;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: `${config.emoji} ${config.headlineEn} — REAiL` }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langChip, locale === 'en' && styles.langChipActive]}
              onPress={() => setLocale('en')}
            >
              <Text style={[styles.langText, locale === 'en' && styles.langTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langChip, locale === 'es' && styles.langChipActive]}
              onPress={() => setLocale('es')}
            >
              <Text style={[styles.langText, locale === 'es' && styles.langTextActive]}>ES</Text>
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              styles.verdictCard,
              {
                borderColor: config.color,
                backgroundColor: config.bg,
                transform: [{ scale: verdict === 'STOP' ? pulseAnim : 1 }],
              },
            ]}
          >
            <View style={[styles.verdictIconWrap, { backgroundColor: config.color }]}>
              <VerdictIcon size={40} color="white" strokeWidth={2.5} />
            </View>
            <Text style={[styles.verdictHeadline, { color: config.color }]}>
              {config.emoji} {isEs ? config.headlineEs : config.headlineEn}
            </Text>
            <View style={[styles.badgePill, { backgroundColor: config.color }]}>
              <Text style={styles.badgePillText}>
                {isEs ? config.badgeLabelEs : config.badgeLabelEn}
              </Text>
            </View>
            {data.score !== null && (
              <Text style={[styles.scoreText, { color: config.color }]}>
                {data.score}/100
              </Text>
            )}
          </Animated.View>

          <View style={styles.domainStrip}>
            <Text style={styles.domainLabel} numberOfLines={1}>{data.domain}</Text>
          </View>

          {reasons.length > 0 && (
            <View style={styles.reasonsCard}>
              {reasons.map((flag, idx) => (
                <View key={idx} style={styles.reasonRow}>
                  <AlertTriangle size={16} color={config.color} />
                  <Text style={styles.reasonText}>{flag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionCard}>
            <Text style={styles.actionText}>{actionText}</Text>
          </View>

          <View style={styles.buttonsArea}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: config.color }]}
              onPress={handleShare}
              activeOpacity={0.85}
              testID="share-btn"
            >
              <Share2 size={20} color="white" strokeWidth={2.5} />
              <Text style={styles.shareBtnText}>
                {isEs ? 'Compartir advertencia' : 'Share Warning'}
              </Text>
            </TouchableOpacity>

            {verdict !== 'OK' && (
              <TouchableOpacity
                style={styles.paidBtn}
                onPress={handleAlreadyPaid}
                activeOpacity={0.85}
                testID="paid-btn"
              >
                <DollarSign size={20} color={Colors.text} />
                <Text style={styles.paidBtnText}>
                  {isEs ? 'Ya pagué' : 'I already paid'}
                </Text>
                <ChevronRight size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>REAiL Scan</Text>
            <Text style={styles.footerDisclaimer}>
              {isEs
                ? 'Análisis basado en señales públicas. No es verdad absoluta.'
                : 'Analysis based on public signals. Not absolute truth.'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 8,
  },
  errorSub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'white',
  },
  langRow: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 4,
    marginBottom: 16,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.backgroundTertiary,
  },
  langChipActive: {
    backgroundColor: Colors.primary,
  },
  langText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
  },
  langTextActive: {
    color: 'white',
  },
  verdictCard: {
    alignItems: 'center' as const,
    borderRadius: 24,
    borderWidth: 2,
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  verdictIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  verdictHeadline: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: 1,
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  badgePill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgePillText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: 'white',
    letterSpacing: 1,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 4,
  },
  domainStrip: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  domainLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  reasonsCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  reasonRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  actionText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  buttonsArea: {
    gap: 12,
    marginBottom: 32,
  },
  shareBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    height: 56,
    borderRadius: 16,
  },
  shareBtnText: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: 'white',
  },
  paidBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paidBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  footer: {
    alignItems: 'center' as const,
    gap: 6,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  footerDisclaimer: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
