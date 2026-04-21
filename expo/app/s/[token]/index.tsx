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
  ArrowLeft,
  Plus,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { resolveShareLink, WalletShareData } from '@/utils/walletShare';

type Verdict = 'STOP' | 'CAUTION' | 'OK';

interface VerdictConfig {
  verdict: Verdict;
  emoji: string;
  headline: string;
  color: string;
  bg: string;
  badgeLabel: string;
  Icon: typeof ShieldOff;
}

const VERDICT_MAP: Record<Verdict, VerdictConfig> = {
  STOP: {
    verdict: 'STOP',
    emoji: '🛑',
    headline: 'STOP PAYING',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.10)',
    badgeLabel: 'HIGH RISK',
    Icon: ShieldOff,
  },
  CAUTION: {
    verdict: 'CAUTION',
    emoji: '⚠️',
    headline: 'REVIEW BEFORE PAYING',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.10)',
    badgeLabel: 'CAUTION',
    Icon: ShieldAlert,
  },
  OK: {
    verdict: 'OK',
    emoji: '✅',
    headline: 'LOOKS SAFE',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.10)',
    badgeLabel: 'OK',
    Icon: ShieldCheck,
  },
};

function computeVerdict(data: WalletShareData): Verdict {
  const score = data.score ?? 50;
  const badge = data.badge;

  if (score <= 35) return 'STOP';
  if (badge === 'HIGH_RISK' || badge === 'UNVERIFIED') return 'STOP';
  if (score >= 70) return 'OK';
  return 'CAUTION';
}

function getActionText(verdict: Verdict): string {
  if (verdict === 'STOP') return '👉 Do NOT enter your card';
  if (verdict === 'CAUTION') return '👉 Review carefully before paying';
  return 'No significant risk signals detected.';
}

function getSubText(verdict: Verdict): string {
  if (verdict === 'STOP') return 'High risk signals detected';
  if (verdict === 'CAUTION') return 'Some signals need your attention';
  return 'No risk signals detected';
}

function getHeaderTitle(verdict: Verdict): string {
  if (verdict === 'STOP') return '🛑 STOP PAYING';
  if (verdict === 'CAUTION') return '⚠️ Review Before Paying';
  return '✅ Looks Safe';
}

function TopNav({ onBack, onNewScan }: { onBack: () => void; onNewScan: () => void }) {
  return (
    <View style={styles.topNav}>
      <TouchableOpacity style={styles.topNavBtn} onPress={onBack} testID="nav-back" activeOpacity={0.7}>
        <ArrowLeft size={18} color={Colors.text} />
        <Text style={styles.topNavBtnText}>Back</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.topNavBtn} onPress={onNewScan} testID="nav-new-scan" activeOpacity={0.7}>
        <Plus size={18} color={Colors.primary} />
        <Text style={[styles.topNavBtnText, { color: Colors.primary }]}>New Scan</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function WalletShieldScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  const { data, isLoading, error, refetch } = useQuery<WalletShareData | null>({
    queryKey: ['share-link', token],
    queryFn: () => resolveShareLink(token || ''),
    enabled: !!token,
    staleTime: 30000,
    retry: 1,
  });

  const verdict = useMemo<Verdict>(() => {
    if (!data) return 'CAUTION';
    return computeVerdict(data);
  }, [data]);

  const config = VERDICT_MAP[verdict];

  useEffect(() => {
    if (verdict === 'STOP') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
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
      document.title = `${config.emoji} ${config.headline} — REAiL Wallet Shield`;

      const setMeta = (attr: 'property' | 'name', key: string, content: string) => {
        let tag = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute(attr, key);
          document.head.appendChild(tag);
        }
        tag.content = content;
      };

      const ogTitle = verdict === 'STOP'
        ? '🛑 STOP PAYING — REAiL Wallet Shield'
        : verdict === 'CAUTION'
        ? '⚠️ Review Before Paying — REAiL Wallet Shield'
        : '✅ Looks Safe — REAiL Wallet Shield';
      const ogDesc = verdict === 'STOP'
        ? 'High risk signals detected. Check before you pay.'
        : verdict === 'CAUTION'
        ? 'Some signals need your attention. Review before paying.'
        : 'Scan any link before you pay. REAiL Wallet Shield.';

      setMeta('name', 'description', ogDesc);
      setMeta('property', 'og:title', ogTitle);
      setMeta('property', 'og:description', ogDesc);
      setMeta('property', 'og:type', 'website');
      setMeta('property', 'og:url', window.location.href);
      setMeta('name', 'twitter:card', 'summary');
      setMeta('name', 'twitter:title', ogTitle);
      setMeta('name', 'twitter:description', ogDesc);
    }
  }, [data, config, verdict]);

  const reasons = useMemo(() => {
    if (!data?.top_red_flags) return [];
    return data.top_red_flags.slice(0, 3);
  }, [data?.top_red_flags]);

  const actionText = useMemo(() => {
    if (data?.next_action) return data.next_action;
    return getActionText(verdict);
  }, [data, verdict]);

  const handleShare = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const shareUrl = Platform.OS === 'web'
      ? window.location.href
      : `https://reail.app/s/${token}`;

    const message = verdict === 'STOP'
      ? `🛑 REAiL detected risk in this link. Check before you pay: ${shareUrl}`
      : verdict === 'CAUTION'
      ? `⚠️ REAiL Wallet Shield suggests reviewing this link before paying: ${shareUrl}`
      : `✅ Scanned with REAiL Wallet Shield: ${shareUrl}`;
    const shareTitle = verdict === 'STOP'
      ? '🛑 STOP PAYING — REAiL Wallet Shield'
      : verdict === 'CAUTION'
      ? '⚠️ Review Before Paying — REAiL Wallet Shield'
      : '✅ Looks Safe — REAiL Wallet Shield';

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: shareTitle, text: message, url: shareUrl });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
        }
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      console.log('[Shield] Share error:', err);
    }
  }, [token, verdict, config]);

  const handleAlreadyPaid = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    router.push({
      pathname: '/s/[token]/refund',
      params: { token: token || '' },
    } as never);
  }, [token, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Scanning…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && !data) {
    const fallbackVerdict = VERDICT_MAP.CAUTION;
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <TopNav onBack={() => router.back()} onNewScan={() => router.replace('/')} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerStrip}>
              <Text style={[styles.headerStripText, { color: fallbackVerdict.color }]}>⚠️ Review Before Paying</Text>
            </View>
            <View style={[styles.verdictCard, { borderColor: fallbackVerdict.color, backgroundColor: fallbackVerdict.bg }]}>
              <View style={[styles.verdictIconWrap, { backgroundColor: fallbackVerdict.color }]}>
                <ShieldAlert size={36} color="white" strokeWidth={2.5} />
              </View>
              <View style={[styles.badgePill, { backgroundColor: fallbackVerdict.color }]}>
                <Text style={styles.badgePillText}>CAUTION</Text>
              </View>
            </View>
            <View style={styles.actionCard}>
              <Text style={styles.actionText}>Unable to fully verify. Proceed with caution.</Text>
            </View>
            <View style={styles.buttonsArea}>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: fallbackVerdict.color }]}
                onPress={handleShare}
                activeOpacity={0.85}
                testID="share-btn"
              >
                <Share2 size={20} color="white" strokeWidth={2.5} />
                <Text style={styles.shareBtnText}>Share Caution</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paidBtn}
                onPress={handleAlreadyPaid}
                activeOpacity={0.85}
                testID="paid-btn"
              >
                <DollarSign size={20} color={Colors.text} />
                <Text style={styles.paidBtnText}>I already paid</Text>
                <ChevronRight size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.footer}>
              <Text style={styles.footerBrand}>REAiL Wallet Shield</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <TopNav onBack={() => router.back()} onNewScan={() => router.replace('/')} />
          <View style={styles.centerContent}>
            <OctagonAlert size={48} color={Colors.unverified} />
            <Text style={styles.errorTitle}>Link Not Found</Text>
            <Text style={styles.errorSub}>It may have expired.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} testID="retry-btn">
              <RefreshCw size={18} color="white" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const VerdictIcon = config.Icon;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <TopNav onBack={() => router.back()} onNewScan={() => router.replace('/')} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerStrip}>
            <Text style={[styles.headerStripText, { color: config.color }]}>{getHeaderTitle(verdict)}</Text>
            <Text style={styles.headerSubText}>{getSubText(verdict)}</Text>
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
              <VerdictIcon size={36} color="white" strokeWidth={2.5} />
            </View>
            <View style={[styles.badgePill, { backgroundColor: config.color }]}>
              <Text style={styles.badgePillText}>{config.badgeLabel}</Text>
            </View>
          </Animated.View>

          {reasons.length > 0 && (
            <View style={styles.reasonsCard}>
              {reasons.map((flag, idx) => (
                <View key={idx} style={styles.reasonRow}>
                  <AlertTriangle size={15} color={config.color} />
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
              <Text style={styles.shareBtnText}>{verdict === 'STOP' ? 'Share Warning' : verdict === 'CAUTION' ? 'Share Caution' : 'Share Result'}</Text>
            </TouchableOpacity>

            {verdict !== 'OK' && (
              <TouchableOpacity
                style={styles.paidBtn}
                onPress={handleAlreadyPaid}
                activeOpacity={0.85}
                testID="paid-btn"
              >
                <DollarSign size={20} color={Colors.text} />
                <Text style={styles.paidBtnText}>I already paid</Text>
                <ChevronRight size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>REAiL Wallet Shield</Text>
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
    paddingTop: 8,
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
  headerStrip: {
    alignItems: 'center' as const,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 6,
  },
  headerStripText: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: Colors.primary,
    letterSpacing: 1.2,
    textAlign: 'center' as const,
  },
  headerSubText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#A0A0B0',
    letterSpacing: 0.5,
  },
  verdictCard: {
    alignItems: 'center' as const,
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  verdictIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  badgePill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badgePillText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: 'white',
    letterSpacing: 1.2,
  },
  reasonsCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
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
    fontSize: 17,
    color: Colors.text,
    lineHeight: 24,
    textAlign: 'center' as const,
    fontWeight: '700' as const,
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
    borderRadius: 14,
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
    gap: 4,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  topNav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topNavBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topNavBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
