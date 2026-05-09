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
  Modal,
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
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  EyeOff,
  Copy,
  X,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors, { Fonts } from '@/constants/colors';
import {
  resolveShareLink,
  WalletShareData,
  EvidenceCard,
  EvidenceStatus,
} from '@/utils/walletShare';
import TrustBet from '@/components/TrustBet';
import { useAppState, Verdict } from '@/providers/AppState';

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
    emoji: '⛔',
    headline: 'HIGH RISK',
    color: Colors.highRisk,
    bg: Colors.highRiskBg,
    badgeLabel: 'HIGH RISK',
    Icon: ShieldOff,
  },
  CAUTION: {
    verdict: 'CAUTION',
    emoji: '⚠',
    headline: 'REVIEW',
    color: Colors.unverified,
    bg: Colors.unverifiedBg,
    badgeLabel: 'REVIEW',
    Icon: ShieldAlert,
  },
  OK: {
    verdict: 'OK',
    emoji: '✓',
    headline: 'VERIFIED',
    color: Colors.verified,
    bg: Colors.verifiedBg,
    badgeLabel: 'VERIFIED',
    Icon: ShieldCheck,
  },
};

function computeVerdict(data: WalletShareData): Verdict {
  const score = data.score ?? 50;
  const badge = data.badge;
  if (badge === 'HIGH_RISK') return 'STOP';
  if (badge === 'VERIFIED') return 'OK';
  if (badge === 'UNVERIFIED') return 'CAUTION';
  if (score < 50) return 'STOP';
  if (score >= 80) return 'OK';
  return 'CAUTION';
}

function evidenceVisual(status: EvidenceStatus): {
  color: string;
  label: string;
  Icon: typeof CheckCircle2;
} {
  if (status === 'pass') return { color: Colors.verified, label: 'PASS', Icon: CheckCircle2 };
  if (status === 'warn') return { color: Colors.unverified, label: 'WARN', Icon: AlertTriangle };
  if (status === 'fail') return { color: Colors.highRisk, label: 'FAIL', Icon: XCircle };
  return { color: Colors.textTertiary, label: 'N/A', Icon: HelpCircle };
}

function getWhyText(data: WalletShareData, verdict: Verdict): string {
  const first = data.top_red_flags?.[0];
  if (first) return first;
  if (verdict === 'OK') return 'No risk signals detected.';
  if (verdict === 'CAUTION') return 'Some signals require review.';
  return 'High-risk signals detected.';
}

function TopNav({ onBack, onNewScan }: { onBack: () => void; onNewScan: () => void }) {
  return (
    <View style={styles.topNav}>
      <TouchableOpacity style={styles.topNavBtn} onPress={onBack} testID="nav-back" activeOpacity={0.7}>
        <ArrowLeft size={18} color={Colors.text} />
        <Text style={styles.topNavBtnText}>Back</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.topNavBtn}
        onPress={onNewScan}
        testID="nav-new-scan"
        activeOpacity={0.7}
      >
        <Plus size={18} color={Colors.text} />
        <Text style={styles.topNavBtnText}>New</Text>
      </TouchableOpacity>
    </View>
  );
}

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  shareUrl: string;
  message: string;
  title: string;
  onNativeShare: () => void;
}

function ShareModal({ visible, onClose, shareUrl, message, title, onNativeShare }: ShareModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.log('[ShareModal] copy err', err);
    }
  }, [message]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Trust</Text>
            <TouchableOpacity onPress={onClose} testID="share-modal-close">
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>{title}</Text>

          <View style={styles.sharePreview}>
            <Text style={styles.sharePreviewText} numberOfLines={3}>
              {message}
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={onNativeShare}
              activeOpacity={0.85}
              testID="share-native"
            >
              <Share2 size={16} color="#09090B" strokeWidth={2.5} />
              <Text style={styles.modalBtnPrimaryText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnSecondary}
              onPress={handleCopy}
              activeOpacity={0.85}
              testID="share-copy"
            >
              <Copy size={16} color={Colors.text} strokeWidth={2.5} />
              <Text style={styles.modalBtnSecondaryText}>{copied ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalUrl} numberOfLines={1}>
            {shareUrl}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default function DecisionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const [shareOpen, setShareOpen] = useState<boolean>(false);

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

  const {
    recordScan,
    recordBet,
    addToWatch,
    removeFromWatch,
    isWatching,
    getBet,
  } = useAppState();

  const existingBet = token ? getBet(token) : undefined;
  const [betReveal, setBetReveal] = useState<boolean>(!!existingBet);

  // Record scan + show pulse on STOP
  useEffect(() => {
    if (data && token) {
      console.log('RESULT OPEN:', token);
    }
  }, [token, data]);

  useEffect(() => {
    // Once data arrives and bet already revealed (or no bet pending), record stat once
    if (!data || !token) return;
    if (!betReveal && !existingBet) return;
    const flag = `__reail_recorded_${token}`;
    const w = globalThis as unknown as Record<string, boolean>;
    if (w[flag]) return;
    w[flag] = true;
    recordScan(verdict);
  }, [data, token, verdict, betReveal, existingBet, recordScan]);

  useEffect(() => {
    if (verdict === 'STOP' && betReveal) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [verdict, pulseAnim, betReveal]);

  // OG / web meta
  useEffect(() => {
    if (Platform.OS === 'web' && data) {
      document.title = `${config.emoji} ${config.headline} — REAiL`;
    }
  }, [data, config]);

  const reasons = useMemo(() => data?.top_red_flags?.slice(0, 3) ?? [], [data?.top_red_flags]);

  const watching = token ? isWatching(token) : false;

  const baseUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://reail.app';
  const shareUrl = `${baseUrl}/s/${token}?ref=${token}`;
  const shareTitle =
    verdict === 'STOP'
      ? `⛔ ${data?.domain ?? 'this link'} flagged HIGH RISK on REAiL`
      : verdict === 'CAUTION'
      ? `⚠ ${data?.domain ?? 'this link'} unverified on REAiL`
      : `✓ ${data?.domain ?? 'this link'} verified on REAiL`;
  const shareMessage =
    verdict === 'STOP'
      ? `⛔ REAiL detected risk. Check before you pay: ${shareUrl}`
      : verdict === 'CAUTION'
      ? `⚠ REAiL says review before you trust: ${shareUrl}`
      : `✓ Verified on REAiL: ${shareUrl}`;

  const handleNativeShare = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    console.log('SHARE CLICK:', token);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: shareTitle, text: shareMessage, url: shareUrl });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(shareMessage);
        }
      } else {
        await Share.share({ message: shareMessage });
      }
    } catch (err) {
      console.log('[Decision] Share error:', err);
    }
  }, [token, shareTitle, shareMessage, shareUrl]);

  const handleAlreadyPaid = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    router.push({
      pathname: '/s/[token]/refund',
      params: { token: token || '' },
    } as never);
  }, [token, router]);

  const handleWatch = useCallback(() => {
    if (!data || !token) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (watching) {
      removeFromWatch(token);
    } else {
      addToWatch({
        token,
        domain: data.domain,
        badge: data.badge,
        score: data.score ?? 50,
        verdict,
        addedAt: Date.now(),
      });
    }
  }, [data, token, watching, verdict, addToWatch, removeFromWatch]);

  const handleBet = useCallback(
    (prediction: 'real' | 'fake') => {
      if (!token) return;
      recordBet(token, prediction, verdict);
      setBetReveal(true);
    },
    [token, verdict, recordBet]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.info} />
            <Text style={styles.loadingText}>Resolving…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <TopNav onBack={() => router.back()} onNewScan={() => router.replace('/')} />
          <View style={styles.centerContent}>
            <OctagonAlert size={48} color={Colors.unverified} />
            <Text style={styles.errorTitle}>Couldn't load</Text>
            <Text style={styles.errorSub}>The link may have expired.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} testID="retry-btn">
              <RefreshCw size={16} color="#09090B" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
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
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const VerdictIcon = config.Icon;
  const score = data.score ?? 50;

  // Trust Bet gate: show before reveal
  if (!betReveal) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <TopNav onBack={() => router.back()} onNewScan={() => router.replace('/')} />
          <ScrollView contentContainerStyle={styles.betScroll}>
            <TrustBet domain={data.domain} onSelect={handleBet} />
            <TouchableOpacity
              style={styles.skipBet}
              onPress={() => setBetReveal(true)}
              testID="skip-bet"
              activeOpacity={0.7}
            >
              <Text style={styles.skipBetText}>Skip · reveal verdict</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

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
          {existingBet && (
            <View
              style={[
                styles.betResultPill,
                {
                  borderColor: existingBet.correct ? Colors.verified : Colors.unverified,
                  backgroundColor: existingBet.correct ? Colors.verifiedBg : Colors.unverifiedBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.betResultText,
                  { color: existingBet.correct ? Colors.verified : Colors.unverified },
                ]}
              >
                {existingBet.correct ? 'CORRECT INSTINCT' : 'INSTINCT MISS'}
              </Text>
              <Text style={styles.betResultSub}>
                You bet {existingBet.prediction.toUpperCase()}
              </Text>
            </View>
          )}

          <Animated.View
            style={[
              styles.decisionCard,
              {
                borderColor: config.color,
                backgroundColor: config.bg,
                transform: [{ scale: verdict === 'STOP' ? pulseAnim : 1 }],
              },
            ]}
            testID="decision-card"
          >
            <View style={styles.decisionHeader}>
              <View style={[styles.iconWrap, { backgroundColor: config.color }]}>
                <VerdictIcon size={28} color="#09090B" strokeWidth={2.5} />
              </View>
              <View style={styles.decisionHeaderText}>
                <Text style={[styles.verdictBadge, { color: config.color }]}>
                  {config.badgeLabel}
                </Text>
                <Text style={styles.domain} numberOfLines={1}>
                  {data.domain}
                </Text>
              </View>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreNumber, { color: config.color }]}>{score}</Text>
                <Text style={styles.scoreLabel}>SCORE</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.whyLabel}>WHY</Text>
            <Text style={styles.whyText}>{getWhyText(data, verdict)}</Text>

            {reasons.length > 0 && (
              <View style={styles.flagsList}>
                {reasons.map((flag, idx) => (
                  <View key={idx} style={styles.flagRow}>
                    <View style={[styles.flagDot, { backgroundColor: config.color }]} />
                    <Text style={styles.flagText}>{flag}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: config.color }]}
              onPress={() => setShareOpen(true)}
              activeOpacity={0.85}
              testID="share-btn"
            >
              <Share2 size={16} color="#09090B" strokeWidth={2.5} />
              <Text style={styles.primaryActionText}>
                {verdict === 'STOP' ? 'Warn others' : verdict === 'CAUTION' ? 'Share review' : 'Share trust'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.watchAction,
                watching && { borderColor: Colors.info, backgroundColor: Colors.infoBg },
              ]}
              onPress={handleWatch}
              activeOpacity={0.85}
              testID="watch-btn"
            >
              {watching ? (
                <EyeOff size={16} color={Colors.info} strokeWidth={2.5} />
              ) : (
                <Eye size={16} color={Colors.text} strokeWidth={2.5} />
              )}
              <Text
                style={[styles.watchActionText, watching && { color: Colors.info }]}
                numberOfLines={1}
              >
                {watching ? 'Watching' : 'Watch'}
              </Text>
            </TouchableOpacity>
          </View>

          {verdict !== 'OK' && (
            <TouchableOpacity
              style={styles.paidBtn}
              onPress={handleAlreadyPaid}
              activeOpacity={0.85}
              testID="paid-btn"
            >
              <DollarSign size={16} color={Colors.text} />
              <Text style={styles.paidBtnText}>I already paid — start refund</Text>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}

          {Array.isArray(data.evidence) && data.evidence.length > 0 && (
            <View style={styles.evidenceSection} testID="evidence-pack">
              <Text style={styles.sectionLabel}>EVIDENCE</Text>
              <View style={styles.evidenceList}>
                {data.evidence.slice(0, 4).map((card: EvidenceCard, idx: number) => {
                  const v = evidenceVisual(card.status);
                  const EvIcon = v.Icon;
                  return (
                    <View
                      key={`${card.provider}-${idx}`}
                      style={styles.evidenceCard}
                      testID={`evidence-${card.provider}`}
                    >
                      <View style={[styles.evidenceIconWrap, { backgroundColor: v.color + '22' }]}>
                        <EvIcon size={16} color={v.color} strokeWidth={2.5} />
                      </View>
                      <View style={styles.evidenceBody}>
                        <View style={styles.evidenceHeaderRow}>
                          <Text style={styles.evidenceProvider} numberOfLines={1}>
                            {card.provider_label}
                          </Text>
                          <View style={[styles.evidenceStatusPill, { backgroundColor: v.color }]}>
                            <Text style={styles.evidenceStatusText}>{v.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.evidenceSummary} numberOfLines={2}>
                          {card.summary}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>REAiL · Pre-transaction trust</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <ShareModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl}
        message={shareMessage}
        title={shareTitle}
        onNativeShare={() => {
          setShareOpen(false);
          handleNativeShare();
        }}
      />
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  betScroll: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    paddingBottom: 32,
  },
  skipBet: {
    alignSelf: 'center' as const,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipBetText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Colors.text,
    marginTop: 8,
  },
  errorSub: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  retryText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: '#09090B',
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
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: Colors.text,
  },
  betResultPill: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  betResultText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  betResultSub: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  decisionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 12,
  },
  decisionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  decisionHeaderText: {
    flex: 1,
    gap: 3,
  },
  verdictBadge: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    letterSpacing: 2,
  },
  domain: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.text,
  },
  scoreCol: {
    alignItems: 'flex-end' as const,
  },
  scoreNumber: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 38,
  },
  scoreLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  whyLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textTertiary,
  },
  whyText: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
    lineHeight: 28,
  },
  flagsList: {
    gap: 8,
    marginTop: 4,
  },
  flagRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  flagText: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  primaryActionText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: '#09090B',
    letterSpacing: 0.5,
  },
  watchAction: {
    width: 120,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
  },
  watchActionText: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  paidBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
  },
  paidBtnText: {
    flex: 1,
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: Colors.text,
  },
  evidenceSection: {
    marginTop: 8,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textTertiary,
  },
  evidenceList: {
    gap: 8,
  },
  evidenceCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  evidenceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
  },
  evidenceBody: {
    flex: 1,
    gap: 3,
  },
  evidenceHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  evidenceProvider: {
    flex: 1,
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: Colors.text,
  },
  evidenceStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  evidenceStatusText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: '#09090B',
    letterSpacing: 0.8,
  },
  evidenceSummary: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 12,
  },
  footerBrand: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end' as const,
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  modalTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
  },
  modalSub: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sharePreview: {
    backgroundColor: Colors.surface,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  sharePreviewText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  modalBtnPrimary: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.text,
  },
  modalBtnPrimaryText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: '#09090B',
    letterSpacing: 0.5,
  },
  modalBtnSecondary: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
  },
  modalBtnSecondaryText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  modalUrl: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
  },
});
