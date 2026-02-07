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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as WebBrowser from "expo-web-browser";
import { 
  ArrowLeft, 
  Share2, 
  ChevronDown, 
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  Image as ImageIcon,
  Bot,
  User,
  AlertTriangle,
  FileCheck,
  FileX,
  FileClock,
  FileQuestion,
  HelpCircle,
  Eye,
  Plus,
  Compass,
  Copy,
  Video,
  RefreshCw,
  MessageSquare,
  UserCheck,
  LinkIcon,
  Zap,
} from "lucide-react-native";
import { getCachedScanResult, cacheScanResult } from "../utils/scanCache";
import { fetchScanWithEvidence, reportScan } from "../utils/api";
import { buildWebResultUrl } from "../utils/deepLinking";
import BadgePill, { getBadgeColor, getBadgeBg, getBadgeLabel } from "@/components/ui/BadgePill";
import Colors from "@/constants/colors";
import { 
  PLACEHOLDER_EVIDENCE, 
  getProviderLabel, 
  getEvidenceScoreImpact, 
  formatScoreImpact,
  getStatusColor,
  getStatusLabel,
  buildEvidenceDetails,
  calculateScoreFromEvidence,
} from "@/utils/evidenceEngine";
import type { EvidenceCard as EvidenceCardType, EvidenceStatus as EvidenceStatusType, ScoreAdjustment, ReportType } from "@/types/scan";
import { styles } from "@/components/result/resultStyles";
import { DisclaimerModal, ScoreTooltipModal, SafeViewModal, ReportModal } from "@/components/result/ResultModals";

type ReasonKey = "A" | "B" | "C" | "D" | "E" | "F";

type Reason = {
  title: string;
  summary: string;
  details?: string[];
  whatWouldVerify?: string[];
};

type ContentMetrics = {
  aiProbability?: number;
  humanProbability?: number;
  authenticityScore?: number;
  manipulationRisk?: number;
  scamIndicators?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
};

type EvidenceStatus = EvidenceStatusType;
type EvidenceCard = EvidenceCardType;

type ScanResult = {
  scanId?: string;
  badge?: "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
  score?: number;
  domain?: string;
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  reasons?: Partial<Record<ReasonKey, Reason>>;
  metrics?: ContentMetrics;
  scanVersion?: string;
  shareCard?: {
    headline?: string;
    badge?: string;
    score?: number;
    domain?: string;
    timestamp?: string;
  };
  evidence?: EvidenceCard[];
  summary?: string;
  scoreBreakdown?: {
    baseScore: number;
    adjustments: ScoreAdjustment[];
    finalScore: number;
    badge: string;
  };
};

type Params = {
  scanId?: string;
  payload?: string;
};

const REASON_ICONS: Record<ReasonKey, React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  A: Video,
  B: Copy,
  C: MessageSquare,
  D: UserCheck,
  E: LinkIcon,
  F: Zap,
};

function safeJsonParse<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function BadgeIcon({ badge, size = 24 }: { badge?: ScanResult["badge"]; size?: number }) {
  const color = getBadgeColor(badge ?? "UNVERIFIED");
  if (badge === "VERIFIED") return <ShieldCheck size={size} color={color} strokeWidth={2} />;
  if (badge === "UNVERIFIED") return <ShieldAlert size={size} color={color} strokeWidth={2} />;
  return <ShieldX size={size} color={color} strokeWidth={2} />;
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

function getConfidenceColor(level: string | undefined): string {
  if (level === 'high') return Colors.verified;
  if (level === 'medium') return Colors.unverified;
  return Colors.textTertiary;
}

function getConfidenceLabel(level: string | undefined): string {
  if (level === 'high') return 'HIGH';
  if (level === 'medium') return 'MED';
  return 'LOW';
}

export default function ResultScreen() {
  const router = useRouter();
  const { scanId, payload } = useLocalSearchParams<Params>();

  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [safeViewOpen, setSafeViewOpen] = useState(false);
  const [whyScoreOpen, setWhyScoreOpen] = useState(false);
  const [scoreTooltipOpen, setScoreTooltipOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<ReasonKey, boolean>>({
    A: false, B: false, C: false, D: false, E: false, F: false,
  });
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
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
  const scanIdStr = scanId ? String(scanId) : "";

  const parsedPayload = useMemo(() => {
    const decoded = payload ? decodeURIComponent(String(payload)) : "";
    return safeJsonParse<ScanResult>(decoded);
  }, [payload]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (scanIdStr && !parsedPayload) {
        const found = await getCachedScanResult(scanIdStr);
        if (!active) return;

        if (found) {
          setCached(found);
          return;
        }

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

  const badge = result.badge ?? "UNVERIFIED";
  const score = clampScore(result.score ?? 0);
  const domain = result.domain ?? (result.url ? (() => {
    try { return new URL(result.url).hostname; } catch { return "unknown"; }
  })() : "unknown");

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
      const aHasDetails = (reasonsMerged[a]?.details?.length ?? 0) > 0;
      const bHasDetails = (reasonsMerged[b]?.details?.length ?? 0) > 0;
      if (aHasDetails && !bHasDetails) return -1;
      if (!aHasDetails && bHasDetails) return 1;
      return 0;
    });
  }, [reasonsMerged]);

  const topReasons = useMemo(() => {
    return sortedReasonKeys
      .filter(k => reasonsMerged[k]?.details?.length || reasonsMerged[k]?.summary)
      .slice(0, 5)
      .map(k => ({ key: k, ...reasonsMerged[k] }));
  }, [reasonsMerged, sortedReasonKeys]);

  const evidenceCards: EvidenceCard[] = result.evidence?.length ? result.evidence : PLACEHOLDER_EVIDENCE;
  const hasRealEvidence = !!result.evidence?.length;

  const scoreBreakdown = useMemo(() => {
    if (result.scoreBreakdown) return result.scoreBreakdown;
    if (hasRealEvidence && result.evidence) {
      return calculateScoreFromEvidence(result.evidence);
    }
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

  const shareCardFooter = "Risk-based verification • Not absolute truth";

  const badgeColor = getBadgeColor(badge);
  const badgeBg = getBadgeBg(badge);

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

  const onShareText = async () => {
    const lines: string[] = [];
    lines.push("REAiL Scan Result");
    lines.push(`${getBadgeLabel(badge)} • Risk Score: ${score}/100`);
    lines.push(`Domain: ${domain}`);
    const scanIdToShare = result?.scanId || (result as Record<string, unknown>)?.id;
    if (scanIdToShare) {
      lines.push(`Report: ${buildWebResultUrl(scanIdToShare as string)}`);
    }
    lines.push("");
    lines.push("Top Signals:");
    topReasons.forEach((r) => {
      lines.push(`• ${r.title}: ${r.summary}`);
    });
    lines.push("");
    lines.push(shareCardFooter);

    const message = lines.join("\n");
    
    try {
      await Share.share({ message });
    } catch {
      try {
        await Clipboard.setStringAsync(message);
        if (Platform.OS === "web") {
          alert("Report copied to clipboard!");
        } else {
          Alert.alert("Copied", "Report copied to clipboard.");
        }
      } catch {
        console.log("[Share] Failed to copy");
      }
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
        await Share.share(
          Platform.OS === "ios"
            ? { url: uri }
            : { message: shareMsg, url: uri }
        );
      } catch {
        await onShareText();
      }
    } catch {
      await onShareText();
    }
  };

  const onOpenSafeView = () => {
    if (!result.url) return;
    setSafeViewOpen(true);
  };

  const onConfirmOpenLink = async () => {
    setSafeViewOpen(false);
    if (!result.url) return;
    try {
      await WebBrowser.openBrowserAsync(result.url);
    } catch {
      console.log("[Browser] Failed to open");
    }
  };

  const onAddToWatchlist = () => {
    router.push("/watchlist");
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
        setTimeout(() => {
          setReportModalOpen(false);
          setReportSuccess(false);
          setReportDescription("");
        }, 1500);
      } else {
        Alert.alert("Error", "Could not submit report. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const toggleExpand = (k: ReasonKey) => {
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const toggleEvidenceExpand = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getEvidenceStatusIcon = (status: EvidenceStatus) => {
    switch (status) {
      case 'pass':
        return <FileCheck size={18} color={Colors.verified} strokeWidth={2} />;
      case 'warn':
        return <FileQuestion size={18} color={Colors.unverified} strokeWidth={2} />;
      case 'fail':
        return <FileX size={18} color={Colors.highRisk} strokeWidth={2} />;
      case 'pending':
        return <FileClock size={18} color={Colors.textTertiary} strokeWidth={2} />;
      default:
        return <FileQuestion size={18} color={Colors.textTertiary} strokeWidth={2} />;
    }
  };

  const getEvidenceStatusColor = (status: EvidenceStatus) => {
    switch (status) {
      case 'pass': return Colors.verified;
      case 'warn': return Colors.unverified;
      case 'fail': return Colors.highRisk;
      case 'pending': return Colors.textTertiary;
      default: return Colors.textTertiary;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable 
            onPress={() => router.replace("/")} 
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
          >
            <ArrowLeft size={22} color="white" strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan Result</Text>
          <Pressable 
            onPress={onShareText} 
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
          >
            <Share2 size={20} color="white" strokeWidth={2} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.mainCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.badgeSection}>
            <View style={[styles.badgeIconContainer, { backgroundColor: badgeBg, borderColor: `${badgeColor}40` }]}>
              <BadgeIcon badge={badge} size={40} />
            </View>
            <BadgePill badge={badge} size="hero" showSubtitle />
            <Text style={styles.domainText}>{domain}</Text>
          </View>

          <View style={styles.scoreSection}>
            <Pressable 
              onPress={() => setScoreTooltipOpen(true)}
              style={styles.scoreCircle}
            >
              <Text style={[styles.scoreValue, { color: badgeColor }]}>{score}</Text>
              <Text style={styles.scoreLabel}>Risk Score</Text>
              <View style={styles.scoreTooltipIcon}>
                <Info size={10} color={Colors.textTertiary} strokeWidth={2} />
              </View>
            </Pressable>
            <View style={styles.scoreBarContainer}>
              <View style={styles.scoreBarTrack}>
                <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: badgeColor }]} />
              </View>
              <View style={styles.scoreLabels}>
                <Text style={styles.scoreLabelText}>0</Text>
                <Text style={styles.scoreLabelText}>100</Text>
              </View>
            </View>
          </View>

          <Pressable 
            onPress={() => setWhyScoreOpen(!whyScoreOpen)} 
            style={({ pressed }) => [styles.whyScoreBtn, pressed && styles.whyScoreBtnPressed]}
          >
            <HelpCircle size={14} color={Colors.accent} strokeWidth={2} />
            <Text style={styles.whyScoreText}>Why this score?</Text>
            {whyScoreOpen ? (
              <ChevronDown size={16} color={Colors.textTertiary} strokeWidth={2} />
            ) : (
              <ChevronRight size={16} color={Colors.textTertiary} strokeWidth={2} />
            )}
          </Pressable>

          {whyScoreOpen && (
            <View style={styles.whyScoreContent}>
              {scoreBreakdown && scoreBreakdown.adjustments.length > 0 ? (
                <>
                  <View style={styles.scoreBreakdownHeader}>
                    <Text style={styles.scoreBreakdownBase}>Base Score: {scoreBreakdown.baseScore}</Text>
                  </View>
                  {scoreBreakdown.adjustments.map((adj, idx) => (
                    <View key={idx} style={styles.whyScoreRow}>
                      <View style={[
                        styles.whyScoreIconWrap, 
                        { backgroundColor: adj.impact > 0 ? `${Colors.verified}20` : adj.impact < -20 ? `${Colors.highRisk}20` : `${Colors.unverified}20` }
                      ]}>
                        <Text style={[
                          styles.impactText,
                          { color: adj.impact > 0 ? Colors.verified : adj.impact < -20 ? Colors.highRisk : Colors.unverified }
                        ]}>
                          {formatScoreImpact(adj.impact)}
                        </Text>
                      </View>
                      <View style={styles.whyScoreTextWrap}>
                        <Text style={styles.whyScoreTitle}>{getProviderLabel(adj.provider)}</Text>
                        <Text style={styles.whyScoreSummary}>{adj.reason}</Text>
                      </View>
                      <View style={[
                        styles.severityBadge,
                        { backgroundColor: adj.severity === 'critical' ? `${Colors.highRisk}20` : adj.severity === 'major' ? `${Colors.unverified}20` : `${Colors.textTertiary}20` }
                      ]}>
                        <Text style={[
                          styles.severityText,
                          { color: adj.severity === 'critical' ? Colors.highRisk : adj.severity === 'major' ? Colors.unverified : Colors.textTertiary }
                        ]}>
                          {adj.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <View style={styles.scoreBreakdownFooter}>
                    <Text style={styles.scoreBreakdownFinal}>Final Score: {scoreBreakdown.finalScore}</Text>
                  </View>
                </>
              ) : evidenceImpacts.length > 0 ? (
                evidenceImpacts.map((item, idx) => (
                  <View key={idx} style={styles.whyScoreRow}>
                    <View style={[
                      styles.whyScoreIconWrap, 
                      { backgroundColor: item.impact > 0 ? `${Colors.verified}20` : item.impact < -20 ? `${Colors.highRisk}20` : `${Colors.unverified}20` }
                    ]}>
                      <Text style={[
                        styles.impactText,
                        { color: item.impact > 0 ? Colors.verified : item.impact < -20 ? Colors.highRisk : Colors.unverified }
                      ]}>
                        {formatScoreImpact(item.impact)}
                      </Text>
                    </View>
                    <View style={styles.whyScoreTextWrap}>
                      <Text style={styles.whyScoreTitle}>{item.provider}</Text>
                      <Text style={styles.whyScoreSummary}>{item.summary}</Text>
                    </View>
                    <View style={[
                      styles.statusChip,
                      { backgroundColor: `${getStatusColor(item.status)}20` }
                    ]}>
                      <Text style={[styles.statusChipText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                ))
              ) : topReasons.length > 0 ? (
                topReasons.map((r, idx) => {
                  const IconComponent = REASON_ICONS[r.key as ReasonKey];
                  return (
                    <View key={idx} style={styles.whyScoreRow}>
                      <View style={styles.whyScoreIconWrap}>
                        <IconComponent size={14} color={Colors.accent} strokeWidth={2} />
                      </View>
                      <View style={styles.whyScoreTextWrap}>
                        <Text style={styles.whyScoreTitle}>{r.title}</Text>
                        <Text style={styles.whyScoreSummary}>{r.summary}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.whyScoreBullet}>
                  Not enough evidence to confirm authenticity. Use context and cross-check with other sources.
                </Text>
              )}
            </View>
          )}

          {loadingRemote && (
            <Text style={styles.loadingText}>Loading shared result…</Text>
          )}
          {!!remoteError && (
            <Text style={styles.errorText}>{remoteError}</Text>
          )}

          <View style={styles.heroSubtitleRow}>
            <Text style={styles.heroSubtitle}>Risk-based verification. Not absolute truth.</Text>
            <Pressable 
              onPress={() => setDisclaimerOpen(true)} 
              style={({ pressed }) => [styles.infoBtn, pressed && styles.infoBtnPressed]}
            >
              <Info size={16} color={Colors.textTertiary} strokeWidth={2} />
            </Pressable>
          </View>
        </Animated.View>

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
              <Pressable 
                onPress={onOpenSafeView} 
                style={({ pressed }) => [styles.nbaBtn, styles.nbaBtnPrimary, pressed && styles.nbaBtnPrimaryPressed]}
              >
                <Eye size={16} color="white" strokeWidth={2.5} />
                <Text style={styles.nbaBtnPrimaryText}>{nbaContent.cta1}</Text>
              </Pressable>
            )}
            <Pressable 
              onPress={onAddToWatchlist} 
              style={({ pressed }) => [styles.nbaBtn, styles.nbaBtnSecondary, pressed && styles.nbaBtnSecondaryPressed]}
            >
              <Plus size={16} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.nbaBtnSecondaryText}>{nbaContent.cta2}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Pressable 
            onPress={onShareText} 
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
          >
            <Share2 size={18} color="white" strokeWidth={2.5} />
            <Text style={styles.primaryBtnText}>Share Report</Text>
          </Pressable>
          
          <Pressable 
            onPress={onShareImage} 
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
          >
            <ImageIcon size={18} color="white" strokeWidth={2} />
            <Text style={styles.secondaryBtnText}>Share as Image</Text>
          </Pressable>
        </View>

        <View style={styles.evidenceSection}>
          <View style={styles.evidenceTitleRow}>
            <Text style={styles.sectionTitle}>Evidence Pack</Text>
            <View style={styles.evidenceHint}>
              <Info size={12} color={Colors.textTertiary} strokeWidth={2} />
              <Text style={styles.evidenceHintText}>Unlocks verified status</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            {hasRealEvidence ? "Verification sources and signals" : "Verification requires evidence, not claims"}
          </Text>

          {result.summary && (
            <View style={styles.evidenceSummaryCard}>
              <Text style={styles.evidenceSummaryText}>{result.summary}</Text>
            </View>
          )}

          {evidenceCards.map((item) => {
            const isOpen = expandedEvidence[item.id] ?? false;
            const isPending = item.status === 'pending';
            const impact = getEvidenceScoreImpact(item);
            const details = item.payload ? buildEvidenceDetails(item) : [];
            const providerLabel = item.providerLabel || getProviderLabel(item.provider);
            
            return (
              <Pressable
                key={item.id}
                onPress={() => !isPending && (item.payload || details.length > 0) && toggleEvidenceExpand(item.id)}
                style={({ pressed }) => [
                  styles.evidenceCard,
                  isPending && styles.evidenceCardPending,
                  pressed && !isPending && styles.evidenceCardPressed
                ]}
              >
                <View style={styles.evidenceHeader}>
                  <View style={[styles.evidenceIconContainer, isPending && styles.evidenceIconPending]}>
                    {getEvidenceStatusIcon(item.status)}
                  </View>
                  <View style={styles.evidenceContentWrapper}>
                    <View style={styles.evidenceProviderRow}>
                      <Text style={[styles.evidenceProvider, isPending && styles.evidenceProviderPending]}>
                        {providerLabel}
                      </Text>
                      <View style={[styles.evidenceStatusBadge, { backgroundColor: `${getEvidenceStatusColor(item.status)}20` }]}>
                        <Text style={[styles.evidenceStatusText, { color: getEvidenceStatusColor(item.status) }]}>
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                      {!isPending && impact !== 0 && (
                        <View style={[
                          styles.evidenceImpactBadge, 
                          { backgroundColor: impact > 0 ? `${Colors.verified}20` : `${Colors.highRisk}20` }
                        ]}>
                          <Text style={[
                            styles.evidenceImpactText, 
                            { color: impact > 0 ? Colors.verified : Colors.highRisk }
                          ]}>
                            {formatScoreImpact(impact)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.evidenceSummary, isPending && styles.evidenceSummaryPending]} numberOfLines={isOpen ? undefined : 2}>
                      {isPending ? "Coming soon" : item.summary}
                    </Text>
                    {item.weight !== undefined && !isPending && (
                      <Text style={styles.evidenceWeight}>Weight: {item.weight}%</Text>
                    )}
                  </View>
                  {(item.payload || details.length > 0) && !isPending && (
                    isOpen ? (
                      <ChevronDown size={18} color={Colors.textTertiary} strokeWidth={2} />
                    ) : (
                      <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={2} />
                    )
                  )}
                </View>

                {isOpen && (details.length > 0 || item.payload) && (
                  <View style={styles.evidencePayload}>
                    {details.length > 0 && (
                      <View style={styles.evidenceDetailsSection}>
                        <Text style={styles.evidencePayloadTitle}>Details</Text>
                        {details.map((d, i) => (
                          <Text key={i} style={styles.evidenceDetailItem}>• {d}</Text>
                        ))}
                      </View>
                    )}
                    {item.payload && (
                      <View style={styles.evidenceRawSection}>
                        <Text style={styles.evidencePayloadTitle}>Raw Data</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <Text style={styles.evidencePayloadText}>
                            {JSON.stringify(item.payload, null, 2)}
                          </Text>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {result.metrics && (
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Signals</Text>
            <Text style={styles.sectionSubtitle}>Content patterns and risk indicators</Text>
            
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Bot size={16} color={Colors.accent} strokeWidth={2} />
                  <Text style={styles.metricLabel}>AI Probability</Text>
                </View>
                <Text style={styles.metricSubtitle}>content-level</Text>
                <Text style={[styles.metricValue, { color: (result.metrics.aiProbability ?? 0) > 50 ? Colors.highRisk : Colors.verified }]}>
                  {result.metrics.aiProbability ?? 50}%
                </Text>
                <View style={styles.metricBar}>
                  <View style={[styles.metricBarFill, { width: `${result.metrics.aiProbability ?? 50}%`, backgroundColor: (result.metrics.aiProbability ?? 0) > 50 ? Colors.highRisk : Colors.verified }]} />
                </View>
                <View style={[styles.confidenceChip, { backgroundColor: `${getConfidenceColor(result.metrics.confidenceLevel)}20` }]}>
                  <Text style={[styles.confidenceChipText, { color: getConfidenceColor(result.metrics.confidenceLevel) }]}>
                    {getConfidenceLabel(result.metrics.confidenceLevel)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <User size={16} color={Colors.verified} strokeWidth={2} />
                  <Text style={styles.metricLabel}>Human Probability</Text>
                </View>
                <Text style={styles.metricSubtitle}>content-level</Text>
                <Text style={[styles.metricValue, { color: (result.metrics.humanProbability ?? 0) > 50 ? Colors.verified : Colors.unverified }]}>
                  {result.metrics.humanProbability ?? 50}%
                </Text>
                <View style={styles.metricBar}>
                  <View style={[styles.metricBarFill, { width: `${result.metrics.humanProbability ?? 50}%`, backgroundColor: (result.metrics.humanProbability ?? 0) > 50 ? Colors.verified : Colors.unverified }]} />
                </View>
              </View>
              
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <AlertTriangle size={16} color={Colors.unverified} strokeWidth={2} />
                  <Text style={styles.metricLabel}>Manipulation Risk</Text>
                </View>
                <Text style={styles.metricSubtitle}>pattern-level</Text>
                <Text style={[styles.metricValue, { color: (result.metrics.manipulationRisk ?? 0) > 50 ? Colors.highRisk : Colors.verified }]}>
                  {result.metrics.manipulationRisk ?? 50}%
                </Text>
                <View style={styles.metricBar}>
                  <View style={[styles.metricBarFill, { width: `${result.metrics.manipulationRisk ?? 50}%`, backgroundColor: (result.metrics.manipulationRisk ?? 0) > 50 ? Colors.highRisk : Colors.verified }]} />
                </View>
              </View>
              
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <ShieldAlert size={16} color={Colors.highRisk} strokeWidth={2} />
                  <Text style={styles.metricLabel}>Scam Indicators</Text>
                </View>
                <Text style={styles.metricSubtitle}>platform-level</Text>
                <Text style={[styles.metricValue, { color: (result.metrics.scamIndicators ?? 0) > 2 ? Colors.highRisk : Colors.verified }]}>
                  {result.metrics.scamIndicators ?? 0}/10
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.reasonsSection}>
          <Text style={styles.sectionTitle}>Analysis Details</Text>
          <Text style={styles.sectionSubtitle}>Tap to expand each category</Text>

          {sortedReasonKeys.map((k) => {
            const item = reasonsMerged[k];
            const isOpen = expanded[k];
            const hasDetails = (item.details?.length ?? 0) > 0;
            const IconComponent = REASON_ICONS[k];
            return (
              <Pressable 
                key={k} 
                onPress={() => toggleExpand(k)} 
                style={({ pressed }) => [
                  styles.reasonCard,
                  hasDetails && styles.reasonCardHighlighted,
                  pressed && styles.reasonCardPressed
                ]}
              >
                <View style={styles.reasonHeader}>
                  <View style={[styles.reasonKeyBadge, hasDetails && styles.reasonKeyBadgeHighlighted]}>
                    <IconComponent size={16} color={hasDetails ? Colors.accent : Colors.textTertiary} strokeWidth={2} />
                  </View>
                  <View style={styles.reasonContentWrapper}>
                    <Text style={styles.reasonTitle}>{item.title}</Text>
                    <Text style={styles.reasonSummary}>{item.summary}</Text>
                  </View>
                  {isOpen ? (
                    <ChevronDown size={20} color={Colors.textTertiary} strokeWidth={2} />
                  ) : (
                    <ChevronRight size={20} color={Colors.textTertiary} strokeWidth={2} />
                  )}
                </View>

                {isOpen && (
                  <View style={styles.reasonBody}>
                    {!!item.details?.length && (
                      <View style={styles.reasonDetailsSection}>
                        <Text style={styles.reasonBodyTitle}>Details</Text>
                        {item.details.map((d, i) => (
                          <Text key={i} style={styles.reasonBullet}>• {d}</Text>
                        ))}
                      </View>
                    )}

                    {!!item.whatWouldVerify?.length && (
                      <View style={styles.reasonDetailsSection}>
                        <Text style={styles.reasonBodyTitle}>What would verify this?</Text>
                        {item.whatWouldVerify.map((d, i) => (
                          <Text key={i} style={styles.reasonBullet}>• {d}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

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
            </View>
            <Text style={styles.shareCardFooter}>{shareCardFooter}</Text>
          </View>
        </View>

        <View style={styles.reportSection}>
          <Pressable
            onPress={() => setReportModalOpen(true)}
            style={({ pressed }) => [styles.reportBtn, pressed && styles.reportBtnPressed]}
          >
            <AlertTriangle size={16} color={Colors.unverified} strokeWidth={2} />
            <Text style={styles.reportBtnText}>Report this URL</Text>
          </Pressable>
          <Text style={styles.reportHint}>Help the community by flagging suspicious content</Text>
        </View>

        <Pressable 
          onPress={() => router.replace("/")} 
          style={({ pressed }) => [styles.newScanBtn, pressed && styles.newScanBtnPressed]}
        >
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
