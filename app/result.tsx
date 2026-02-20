import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Share,
  Platform,
  Alert,
  Animated,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowLeft,
  Share2,
  Shield,
  Eye,
  Plus,
  Compass,
  Image as ImageIcon,
  MessageSquare,
  Mail,
  DollarSign,
  AlertTriangle,
  RefreshCw,
} from "lucide-react-native";
import { getCachedScanResult, cacheScanResult } from "../utils/scanCache";
import { fetchScanWithEvidence, reportScan, fetchDomainTrustProfile } from "../utils/api";
import { buildWebResultUrl } from "../utils/deepLinking";
import { trackEvent } from "../utils/analytics";

import BadgePill, { getBadgeColor, getBadgeBg, getBadgeLabel } from "@/components/ui/BadgePill";
import Colors from "@/constants/colors";
import {
  PLACEHOLDER_EVIDENCE,
  getProviderLabel,
  getEvidenceScoreImpact,
  calculateScoreFromEvidence,
} from "@/utils/evidenceEngine";
import type {
  EvidenceCard as EvidenceCardType,
  ScoreAdjustment,
  ReportType,
  DomainTrustProfile,
  BadgeType,
} from "@/types/scan";
import { styles } from "@/components/result/resultStyles";
import { DisclaimerModal, ScoreTooltipModal, SafeViewModal, ReportModal } from "@/components/result/ResultModals";

import DecisionCard from "@/components/result/DecisionCard";
import EvidenceSection from "@/components/result/EvidenceSection";
import AnalysisDetails from "@/components/result/AnalysisDetails";
import TrustGraphCard from "@/components/result/TrustGraphCard";
import MockBanner from "@/components/result/MockBanner";
import ResultSkeleton from "@/components/result/ResultSkeleton";

type ReasonKey = "A" | "B" | "C" | "D" | "E" | "F";

type Reason = {
  title: string;
  summary: string;
  details?: string[];
  whatWouldVerify?: string[];
};

type ScanResult = {
  scanId?: string;
  badge?: "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
  score?: number;
  domain?: string;
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  reasons?: Partial<Record<ReasonKey, Reason>>;
  metrics?: {
    aiProbability?: number;
    humanProbability?: number;
    authenticityScore?: number;
    manipulationRisk?: number;
    scamIndicators?: number;
    confidenceLevel?: "high" | "medium" | "low";
  };
  scanVersion?: string;
  shareCard?: {
    headline?: string;
    badge?: string;
    score?: number;
    domain?: string;
    timestamp?: string;
  };
  evidence?: EvidenceCardType[];
  summary?: string;
  scoreBreakdown?: {
    baseScore: number;
    adjustments: ScoreAdjustment[];
    finalScore: number;
    badge: BadgeType;
  };
  isMock?: boolean;
};

type Params = {
  scanId?: string;
  payload?: string;
};

function safeJsonParse<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampScore(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function defaultReasons(): Record<ReasonKey, Reason> {
  return {
    A: { title: "Media Integrity", summary: "Signals related to editing or synthetic media." },
    B: { title: "Duplicate / Re-used Media", summary: "Signals that media may be recycled or mismatched." },
    C: { title: "Claims vs Public Signals", summary: "Claims compared to available public signals." },
    D: { title: "Account Signals", summary: "Account patterns that may indicate risk." },
    E: { title: "Link Safety", summary: "Redirects, suspicious domains, or phishing indicators." },
    F: { title: "Patterns / Reports", summary: "Signals matching known scam patterns or repeated behaviors." },
  };
}

export default function ResultScreen() {
  const router = useRouter();
  const { scanId, payload } = useLocalSearchParams<Params>();

  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [safeViewOpen, setSafeViewOpen] = useState(false);
  const [scoreTooltipOpen, setScoreTooltipOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("scam");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const shareCardRef = useRef<View>(null);

  const [cached, setCached] = useState<ScanResult | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [trustProfile, setTrustProfile] = useState<DomainTrustProfile | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);

  const scanIdStr = scanId ? String(scanId) : "";

  const parsedPayload = useMemo(() => {
    const decoded = payload ? decodeURIComponent(String(payload)) : "";
    return safeJsonParse<ScanResult>(decoded);
  }, [payload]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (scanIdStr && !parsedPayload) {
        const found = await getCachedScanResult(scanIdStr);
        if (!active) return;
        if (found) { setCached(found); return; }

        setLoadingRemote(true);
        setRemoteError(null);
        const remote = await fetchScanWithEvidence(scanIdStr);
        if (!active) return;
        setLoadingRemote(false);

        if (!remote) {
          setRemoteError("Could not load shared result. Try again later.");
          return;
        }

        const normalized: ScanResult = {
          scanId: remote.id,
          badge: remote.badge,
          score: remote.score,
          url: remote.url,
          domain: remote.domain,
          title: remote.title,
          reasons: remote.reasons,
          evidence: remote.evidence,
          summary: remote.summary,
          scoreBreakdown: remote.scoreBreakdown,
        };
        setCached(normalized);
        await cacheScanResult(remote.id, normalized);
      }
    })();
    return () => { active = false; };
  }, [scanIdStr, parsedPayload]);

  const result: ScanResult = useMemo(() => {
    if (parsedPayload) return parsedPayload;
    if (cached) return cached;
    return {
      scanId: scanIdStr || undefined,
      badge: "UNVERIFIED",
      score: 60,
      domain: "reail.app",
      title: "Loading shared report...",
      reasons: defaultReasons(),
    };
  }, [parsedPayload, cached, scanIdStr]);

  const badge = (result.badge ?? "UNVERIFIED") as BadgeType;
  const score = clampScore(result.score ?? 0);
  const domain = result.domain ?? (result.url ? (() => {
    try { return new URL(result.url!).hostname; } catch { return "unknown"; }
  })() : "unknown");

  useEffect(() => {
    if (domain && domain !== 'unknown' && domain !== 'reail.app') {
      setTrustLoading(true);
      fetchDomainTrustProfile(domain)
        .then((profile) => {
          setTrustProfile(profile);
          if (profile) {
            trackEvent('trust_graph_viewed', { domain, tier: profile.trustTier });
          }
        })
        .finally(() => setTrustLoading(false));
    }
  }, [domain]);

  useEffect(() => {
    trackEvent('scan_result_viewed', { badge, score, domain });
  }, [badge, score, domain]);

  const reasonsMerged: Record<ReasonKey, Reason> = useMemo(() => {
    const base = defaultReasons();
    const r = result.reasons || {};
    return {
      A: { ...base.A, ...r.A },
      B: { ...base.B, ...r.B },
      C: { ...base.C, ...r.C },
      D: { ...base.D, ...r.D },
      E: { ...base.E, ...r.E },
      F: { ...base.F, ...r.F },
    };
  }, [result.reasons]);

  const sortedReasonKeys = useMemo(() => {
    const keys: ReasonKey[] = ["A", "B", "C", "D", "E", "F"];
    return keys.sort((a, b) => {
      const aHas = (reasonsMerged[a]?.details?.length ?? 0) > 0;
      const bHas = (reasonsMerged[b]?.details?.length ?? 0) > 0;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });
  }, [reasonsMerged]);

  const topReasons = useMemo(() => {
    return sortedReasonKeys
      .filter(k => reasonsMerged[k]?.details?.length || reasonsMerged[k]?.summary)
      .slice(0, 5)
      .map(k => ({ key: k, ...reasonsMerged[k] }));
  }, [reasonsMerged, sortedReasonKeys]);

  const evidenceCards: EvidenceCardType[] = result.evidence?.length ? result.evidence : PLACEHOLDER_EVIDENCE;
  const hasRealEvidence = !!result.evidence?.length;

  const scoreBreakdown = useMemo(() => {
    if (result.scoreBreakdown) return result.scoreBreakdown;
    if (hasRealEvidence && result.evidence) return calculateScoreFromEvidence(result.evidence);
    return null;
  }, [result.scoreBreakdown, result.evidence, hasRealEvidence]);

  const evidenceImpacts = useMemo(() => {
    if (!hasRealEvidence || !evidenceCards) return [];
    return evidenceCards
      .filter(e => e.status !== 'pending')
      .map(e => ({
        provider: e.providerLabel || getProviderLabel(e.provider),
        status: e.status,
        impact: getEvidenceScoreImpact(e),
        summary: e.summary,
      }))
      .sort((a, b) => a.impact - b.impact);
  }, [hasRealEvidence, evidenceCards]);

  const badgeColor = getBadgeColor(badge);
  const badgeBg = getBadgeBg(badge);
  const shareCardFooter = "Risk-based verification • Not absolute truth";

  const nbaContent = useMemo(() => {
    if (badge === "VERIFIED") {
      return {
        title: "Next Best Action",
        message: "Proceed, but stay aware",
        tips: ["Verify the creator or account independently", "Check recent activity and reviews", "Trust but verify with context"],
        cta1: "Open in Safe View",
        cta2: "Add to Watchlist",
      };
    }
    if (badge === "UNVERIFIED") {
      return {
        title: "Next Best Action",
        message: "Do not rely on this alone",
        tips: ["Cross-check with other sources", "Review account history and comments", "Look for official verification marks"],
        cta1: "Open in Safe View",
        cta2: "Add to Watchlist",
      };
    }
    return {
      title: "Next Best Action",
      message: "Do not proceed",
      tips: ["Do not pay or share personal info", "Report suspicious activity", "Consider blocking or avoiding this source"],
      cta1: "Open in Safe View",
      cta2: "Add to Watchlist",
    };
  }, [badge]);

  const getShareMsg = () => {
    const sid = result?.scanId || (result as Record<string, unknown>)?.id;
    const link = sid ? buildWebResultUrl(sid as string) : '';
    return { link, msg: `REAiL: ${getBadgeLabel(badge)} • ${score}/100 — ${domain}\n${link}` };
  };

  const onShareText = async () => {
    const lines: string[] = [];
    lines.push("REAiL Scan Result");
    lines.push(`${getBadgeLabel(badge)} • Risk Score: ${score}/100`);
    lines.push(`Domain: ${domain}`);
    const scanIdToShare = result?.scanId || (result as Record<string, unknown>)?.id;
    if (scanIdToShare) lines.push(`Report: ${buildWebResultUrl(scanIdToShare as string)}`);
    lines.push("");
    lines.push("Top Signals:");
    topReasons.forEach((r) => { lines.push(`• ${r.title}: ${r.summary}`); });
    lines.push("");
    lines.push(shareCardFooter);

    const message = lines.join("\n");
    try {
      await Share.share({ message });
      trackEvent('share_created', { method: 'text' });
    } catch {
      try {
        await Clipboard.setStringAsync(message);
        if (Platform.OS === "web") alert("Report copied to clipboard!");
        else Alert.alert("Copied", "Report copied to clipboard.");
      } catch { console.log("[Share] Failed to copy"); }
    }
  };

  const onShareImage = async () => {
    try {
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1 });
      const scanIdToShare = result?.scanId || (result as Record<string, unknown>)?.id;
      const shareMsg = scanIdToShare
        ? `${shareCardFooter}\n${buildWebResultUrl(scanIdToShare as string)}`
        : shareCardFooter;
      try {
        await Share.share(Platform.OS === "ios" ? { url: uri } : { message: shareMsg, url: uri });
        trackEvent('share_created', { method: 'image' });
      } catch { await onShareText(); }
    } catch { await onShareText(); }
  };

  const onOpenSafeView = () => { if (result.url) setSafeViewOpen(true); };
  const onConfirmOpenLink = async () => {
    setSafeViewOpen(false);
    if (!result.url) return;
    try { await WebBrowser.openBrowserAsync(result.url); } catch { console.log("[Browser] Failed to open"); }
  };
  const onAddToWatchlist = () => { router.push("/watchlist" as any); };
  const onStartMoneyCase = () => {
    trackEvent('money_case_started', { domain });
    router.push(`/money-case?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(result.url || '')}&scanId=${encodeURIComponent(result.scanId || '')}` as any);
  };

  const onShareWhatsApp = async () => {
    const { msg } = getShareMsg();
    try { await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`); trackEvent('share_created', { method: 'whatsapp' }); } catch { await onShareText(); }
  };
  const onShareSMS = async () => {
    const { msg } = getShareMsg();
    if (Platform.OS === 'web') { await onShareText(); return; }
    const smsUrl = Platform.OS === 'ios' ? `sms:&body=${encodeURIComponent(msg)}` : `sms:?body=${encodeURIComponent(msg)}`;
    try { await Linking.openURL(smsUrl); trackEvent('share_created', { method: 'sms' }); } catch { await onShareText(); }
  };
  const onShareEmail = async () => {
    const { msg } = getShareMsg();
    const subj = `REAiL Scan: ${getBadgeLabel(badge)} - ${domain}`;
    try { await Linking.openURL(`mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}`); trackEvent('share_created', { method: 'email' }); } catch { await onShareText(); }
  };

  const onSubmitReport = async () => {
    if (!result.url && !domain) return;
    setReportSubmitting(true);
    try {
      const resp = await reportScan({
        scan_id: result.scanId,
        url: result.url || `https://${domain}`,
        report_type: reportType,
        description: reportDescription.trim() || undefined,
      });
      if (resp) {
        setReportSuccess(true);
        setTimeout(() => { setReportModalOpen(false); setReportSuccess(false); setReportDescription(""); }, 1500);
      } else {
        Alert.alert("Error", "Could not submit report. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const showSkeleton = !parsedPayload && !cached && (loadingRemote || !scanIdStr);

  if (showSkeleton && loadingRemote) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.header}>
            <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
              <ArrowLeft size={22} color="white" strokeWidth={2} />
            </Pressable>
            <Text style={styles.headerTitle}>Scan Result</Text>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>
        <ResultSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
            <ArrowLeft size={22} color="white" strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan Result</Text>
          <Pressable onPress={onShareText} style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
            <Share2 size={20} color="white" strokeWidth={2} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {result.isMock && <MockBanner />}

        <DecisionCard
          badge={badge}
          score={score}
          domain={domain}
          badgeColor={badgeColor}
          badgeBg={badgeBg}
          fadeAnim={fadeAnim}
          scaleAnim={scaleAnim}
          loadingRemote={loadingRemote}
          remoteError={remoteError}
          scoreBreakdown={scoreBreakdown}
          evidenceImpacts={evidenceImpacts}
          topReasons={topReasons}
          onDisclaimerPress={() => setDisclaimerOpen(true)}
          onScoreTooltipPress={() => setScoreTooltipOpen(true)}
        />

        <TrustGraphCard profile={trustProfile} loading={trustLoading} />

        <View style={[styles.nbaSection, { borderColor: `${badgeColor}30` }]}>
          <View style={styles.nbaTitleRow}>
            <View style={[styles.nbaIconWrap, { backgroundColor: `${badgeColor}20` }]}>
              <Compass size={18} color={badgeColor} strokeWidth={2} />
            </View>
            <Text style={styles.nbaTitle}>{nbaContent.title}</Text>
          </View>
          <Text style={[styles.nbaMessage, { color: badgeColor }]}>{nbaContent.message}</Text>
          <View style={styles.nbaTips}>
            {nbaContent.tips.map((tip, idx) => (
              <Text key={idx} style={styles.nbaTip}>• {tip}</Text>
            ))}
          </View>
          <View style={styles.nbaActions}>
            {!!result.url && (
              <Pressable onPress={onOpenSafeView} style={({ pressed }) => [styles.nbaBtn, styles.nbaBtnPrimary, pressed && styles.nbaBtnPrimaryPressed]}>
                <Eye size={16} color="white" strokeWidth={2.5} />
                <Text style={styles.nbaBtnPrimaryText}>{nbaContent.cta1}</Text>
              </Pressable>
            )}
            <Pressable onPress={onAddToWatchlist} style={({ pressed }) => [styles.nbaBtn, styles.nbaBtnSecondary, pressed && styles.nbaBtnSecondaryPressed]}>
              <Plus size={16} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.nbaBtnSecondaryText}>{nbaContent.cta2}</Text>
            </Pressable>
          </View>
        </View>

        {badge === "HIGH_RISK" && (
          <View style={styles.moneyCaseCard}>
            <View style={styles.moneyCaseTitleRow}>
              <View style={styles.moneyCaseIcon}>
                <DollarSign size={20} color={Colors.highRisk} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moneyCaseTitle}>Get your money back</Text>
                <Text style={styles.moneyCaseSubtitle}>Guidance, templates, and workflows for refund / dispute</Text>
              </View>
            </View>
            <Pressable onPress={onStartMoneyCase} style={({ pressed }) => [styles.moneyCaseBtn, pressed && styles.moneyCaseBtnPressed]}>
              <DollarSign size={16} color="white" strokeWidth={2.5} />
              <Text style={styles.moneyCaseBtnText}>Start Money Case</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.actionsCard}>
          <Pressable onPress={onShareText} style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
            <Share2 size={18} color="white" strokeWidth={2.5} />
            <Text style={styles.primaryBtnText}>Share Report</Text>
          </Pressable>
          <Pressable onPress={onShareImage} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}>
            <ImageIcon size={18} color="white" strokeWidth={2} />
            <Text style={styles.secondaryBtnText}>Share as Image</Text>
          </Pressable>
          <View style={styles.shareChannelsRow}>
            <Pressable onPress={onShareWhatsApp} style={({ pressed }) => [styles.shareChannelBtn, pressed && { opacity: 0.7 }]}>
              <MessageSquare size={14} color="#25D366" strokeWidth={2} />
              <Text style={styles.shareChannelText}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={onShareSMS} style={({ pressed }) => [styles.shareChannelBtn, pressed && { opacity: 0.7 }]}>
              <MessageSquare size={14} color={Colors.accent} strokeWidth={2} />
              <Text style={styles.shareChannelText}>SMS</Text>
            </Pressable>
            <Pressable onPress={onShareEmail} style={({ pressed }) => [styles.shareChannelBtn, pressed && { opacity: 0.7 }]}>
              <Mail size={14} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.shareChannelText}>Email</Text>
            </Pressable>
          </View>
        </View>

        <EvidenceSection
          evidenceCards={evidenceCards}
          hasRealEvidence={hasRealEvidence}
          summary={result.summary}
          metrics={result.metrics}
        />

        <AnalysisDetails
          reasonsMerged={reasonsMerged}
          sortedReasonKeys={sortedReasonKeys}
        />

        <View style={styles.shareCardSection}>
          <Text style={styles.sectionTitle}>Share Card Preview</Text>
          <View ref={shareCardRef} collapsable={false} style={[styles.shareCard, { borderColor: badgeColor, backgroundColor: `${badgeBg}` }]}>
            <View style={styles.shareCardHeader}>
              <Shield size={20} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.shareCardBrand}>REAiL</Text>
            </View>
            <View style={styles.shareCardContent}>
              <BadgePill badge={badge} size="large" />
              <Text style={styles.shareCardScore}>Risk Score: {score}/100</Text>
              <Text style={styles.shareCardDomain}>{domain}</Text>
              {topReasons[0] && (
                <Text style={styles.shareCardReason} numberOfLines={1}>
                  {topReasons[0].title}: {topReasons[0].summary}
                </Text>
              )}
              {result.isMock && (
                <Text style={[styles.shareCardReason, { color: Colors.unverified }]}>
                  Simulated result — verification pending
                </Text>
              )}
            </View>
            <Text style={styles.shareCardFooter}>{shareCardFooter}</Text>
          </View>
        </View>

        <View style={styles.reportSection}>
          <Pressable onPress={() => setReportModalOpen(true)} style={({ pressed }) => [styles.reportBtn, pressed && styles.reportBtnPressed]}>
            <AlertTriangle size={16} color={Colors.unverified} strokeWidth={2} />
            <Text style={styles.reportBtnText}>Report this URL</Text>
          </Pressable>
          <Text style={styles.reportHint}>Help the community by flagging suspicious content</Text>
        </View>

        <View style={styles.fairnessSection}>
          <Pressable
            onPress={() => { trackEvent('appeal_submitted', { scanId: result.scanId ?? '' }); router.push(`/appeal?scanId=${encodeURIComponent(result.scanId || '')}` as any); }}
            style={({ pressed }) => [styles.fairnessBtn, pressed && { opacity: 0.7 }]}
          >
            <AlertTriangle size={14} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.fairnessBtnText}>Is this wrong? Submit an Appeal</Text>
          </Pressable>
          <Pressable
            onPress={() => { trackEvent('claim_submitted', { domain }); router.push('/claim' as any); }}
            style={({ pressed }) => [styles.fairnessBtn, pressed && { opacity: 0.7 }]}
          >
            <Shield size={14} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.fairnessBtnText}>Claim this profile</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.newScanBtn, pressed && styles.newScanBtnPressed]}>
          <RefreshCw size={18} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.newScanText}>Scan Another Link</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <DisclaimerModal visible={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} />
      <ScoreTooltipModal visible={scoreTooltipOpen} onClose={() => setScoreTooltipOpen(false)} />
      <SafeViewModal
        visible={safeViewOpen}
        onClose={() => setSafeViewOpen(false)}
        onConfirm={onConfirmOpenLink}
        domain={domain}
        badge={badge}
        score={score}
      />
      <ReportModal
        visible={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        domain={domain}
        reportType={reportType}
        setReportType={setReportType}
        reportDescription={reportDescription}
        setReportDescription={setReportDescription}
        reportSubmitting={reportSubmitting}
        reportSuccess={reportSuccess}
        onSubmit={onSubmitReport}
      />
    </View>
  );
}
