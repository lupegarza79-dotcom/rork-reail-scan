// app/result.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Share,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as WebBrowser from "expo-web-browser";
import { 
  ArrowLeft, 
  Share2, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  Image as ImageIcon,
  X
} from "lucide-react-native";
import { getCachedScanResult, cacheScanResult } from "../utils/scanCache";
import { fetchScanResultById } from "../utils/api";
import { buildWebResultUrl } from "../utils/deepLinking";
import Colors from "@/constants/colors";

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
  shareCard?: {
    headline?: string;
    badge?: string;
    score?: number;
    domain?: string;
    timestamp?: string;
  };
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

function badgeLabel(badge?: ScanResult["badge"]) {
  if (badge === "VERIFIED") return "VERIFIED";
  if (badge === "UNVERIFIED") return "UNVERIFIED";
  return "HIGH RISK";
}

function getBadgeColor(badge?: ScanResult["badge"]) {
  if (badge === "VERIFIED") return Colors.verified;
  if (badge === "UNVERIFIED") return Colors.unverified;
  return Colors.highRisk;
}

function getBadgeBg(badge?: ScanResult["badge"]) {
  if (badge === "VERIFIED") return Colors.verifiedBg;
  if (badge === "UNVERIFIED") return Colors.unverifiedBg;
  return Colors.highRiskBg;
}

function BadgeIcon({ badge, size = 24 }: { badge?: ScanResult["badge"]; size?: number }) {
  const color = getBadgeColor(badge);
  if (badge === "VERIFIED") return <ShieldCheck size={size} color={color} strokeWidth={2} />;
  if (badge === "UNVERIFIED") return <ShieldAlert size={size} color={color} strokeWidth={2} />;
  return <ShieldX size={size} color={color} strokeWidth={2} />;
}

function badgeHint(badge?: ScanResult["badge"]) {
  if (badge === "VERIFIED") return "Consistent signals across content and source.";
  if (badge === "UNVERIFIED") return "Not enough evidence. Use context.";
  return "Multiple manipulation/scam signals detected.";
}

function clampScore(n: any) {
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
  const [expanded, setExpanded] = useState<Record<ReasonKey, boolean>>({
    A: false,
    B: false,
    C: false,
    D: false,
    E: false,
    F: false,
  });

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

        const remote = await fetchScanResultById(scanIdStr);
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
        };

        setCached(normalized);
        await cacheScanResult(remote.id, normalized);
      }
    })();

    return () => {
      active = false;
    };
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

  const disclaimerShort = "Risk-based AI verification";
  const disclaimerFull =
    "REAiL provides risk-based verification using public signals and automated analysis. It does not claim absolute truth.";
  const shareCardFooter = "Risk-based verification • Not absolute truth";

  const onShareText = async () => {
    const lines: string[] = [];
    lines.push("REAiL Scan Result");
    lines.push(`${badgeLabel(badge)} • Score: ${score}/100`);
    lines.push(`Domain: ${domain}`);
    const scanIdToShare = result?.scanId || (result as any)?.id;
    if (scanIdToShare) {
      lines.push(`Report: ${buildWebResultUrl(scanIdToShare)}`);
    }
    lines.push("");
    lines.push("Why (A–F):");
    (["A", "B", "C", "D", "E", "F"] as ReasonKey[]).forEach((k) => {
      const item = reasonsMerged[k];
      lines.push(`${k}) ${item.title}: ${item.summary}`);
    });
    lines.push("");
    lines.push(shareCardFooter);

    const message = lines.join("\n");
    
    try {
      await Share.share({ message });
    } catch (err) {
      // Fallback for web or when share fails
      try {
        await Clipboard.setStringAsync(message);
        if (Platform.OS === "web") {
          alert("Report copied to clipboard!");
        } else {
          Alert.alert("Copied", "Report copied to clipboard.");
        }
      } catch {
        // Silent fail
      }
    }
  };

  const onShareImage = async () => {
    try {
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
      });
      const scanIdToShare = result?.scanId || (result as any)?.id;
      const shareMsg = scanIdToShare
        ? `${shareCardFooter}\n${buildWebResultUrl(scanIdToShare)}`
        : shareCardFooter;
      
      try {
        await Share.share(
          Platform.OS === "ios"
            ? { url: uri }
            : { message: shareMsg, url: uri }
        );
      } catch {
        // Share failed, fallback to text share
        await onShareText();
      }
    } catch {
      await onShareText();
    }
  };

  const onOpenLink = async () => {
    if (!result.url) return;
    try {
      await WebBrowser.openBrowserAsync(result.url);
    } catch {
      // ignore
    }
  };

  const toggleExpand = (k: ReasonKey) => {
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const badgeColor = getBadgeColor(badge);
  const badgeBg = getBadgeBg(badge);

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
        <View style={styles.mainCard}>
          <View style={styles.badgeSection}>
            <View style={[styles.badgeIconContainer, { backgroundColor: badgeBg }]}>
              <BadgeIcon badge={badge} size={32} />
            </View>
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {badgeLabel(badge)}
            </Text>
            <Text style={styles.domainText}>{domain}</Text>
          </View>

          <View style={styles.scoreSection}>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreValue, { color: badgeColor }]}>{score}</Text>
              <Text style={styles.scoreLabel}>Trust Score</Text>
            </View>
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

          {loadingRemote && (
            <Text style={styles.loadingText}>Loading shared result…</Text>
          )}
          {!!remoteError && (
            <Text style={styles.errorText}>{remoteError}</Text>
          )}

          <View style={styles.verdictContainer}>
            <Text style={styles.verdictText}>{badgeHint(badge)}</Text>
          </View>

          <Pressable 
            onPress={() => setDisclaimerOpen(true)} 
            style={({ pressed }) => [styles.disclaimerPill, pressed && styles.disclaimerPillPressed]}
          >
            <Info size={14} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.disclaimerPillText}>{disclaimerShort}</Text>
          </Pressable>

          {!!result.url && (
            <Pressable 
              onPress={onOpenLink} 
              style={({ pressed }) => [styles.openLinkBtn, pressed && styles.openLinkBtnPressed]}
            >
              <ExternalLink size={16} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.openLinkText}>Open scanned link</Text>
            </Pressable>
          )}
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

        <View style={styles.reasonsSection}>
          <Text style={styles.sectionTitle}>Analysis Details</Text>
          <Text style={styles.sectionSubtitle}>Tap to expand each category</Text>

          {(Object.keys(reasonsMerged) as ReasonKey[]).map((k) => {
            const item = reasonsMerged[k];
            const isOpen = expanded[k];
            return (
              <Pressable 
                key={k} 
                onPress={() => toggleExpand(k)} 
                style={({ pressed }) => [
                  styles.reasonCard,
                  pressed && styles.reasonCardPressed
                ]}
              >
                <View style={styles.reasonHeader}>
                  <View style={styles.reasonKeyBadge}>
                    <Text style={styles.reasonKey}>{k}</Text>
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

          <View ref={shareCardRef} collapsable={false} style={[styles.shareCard, { borderColor: badgeColor }]}>
            <View style={styles.shareCardHeader}>
              <Shield size={20} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.shareCardBrand}>REAiL</Text>
            </View>
            <View style={styles.shareCardContent}>
              <BadgeIcon badge={badge} size={28} />
              <Text style={[styles.shareCardBadge, { color: badgeColor }]}>{badgeLabel(badge)}</Text>
              <Text style={styles.shareCardScore}>Score: {score}/100</Text>
              <Text style={styles.shareCardDomain}>{domain}</Text>
            </View>
            <Text style={styles.shareCardFooter}>{shareCardFooter}</Text>
          </View>
        </View>

        <Pressable 
          onPress={() => router.replace("/")} 
          style={({ pressed }) => [styles.newScanBtn, pressed && styles.newScanBtnPressed]}
        >
          <Text style={styles.newScanText}>Scan Another Link</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={disclaimerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDisclaimerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDisclaimerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verification Disclaimer</Text>
              <Pressable onPress={() => setDisclaimerOpen(false)} style={styles.modalCloseIcon}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
            <Text style={styles.modalBody}>{disclaimerFull}</Text>
            <Pressable 
              style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]} 
              onPress={() => setDisclaimerOpen(false)}
            >
              <Text style={styles.modalCloseText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
  },
  headerBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  headerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600" as const,
  },
  scrollContent: {
    padding: 16,
  },
  mainCard: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  badgeSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  badgeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 24,
    fontWeight: "800" as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  domainText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  scoreSection: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "800" as const,
  },
  scoreLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  scoreBarContainer: {
    flex: 1,
  },
  scoreBarTrack: {
    height: 8,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  scoreLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  scoreLabelText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  verdictContainer: {
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  verdictText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  disclaimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundTertiary,
    marginBottom: 12,
  },
  disclaimerPillPressed: {
    opacity: 0.7,
  },
  disclaimerPillText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: "500" as const,
  },
  openLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  openLinkBtnPressed: {
    backgroundColor: Colors.cardHighlight,
  },
  openLinkText: {
    color: Colors.primary,
    fontWeight: "600" as const,
    fontSize: 14,
  },
  actionsCard: {
    marginTop: 12,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  primaryBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "700" as const,
    fontSize: 15,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  secondaryBtnText: {
    color: "white",
    fontWeight: "600" as const,
    fontSize: 14,
  },
  reasonsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.textTertiary,
    fontSize: 13,
    marginBottom: 16,
  },
  reasonCard: {
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  reasonCardPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  reasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  reasonKeyBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonKey: {
    color: Colors.primary,
    fontWeight: "800" as const,
    fontSize: 14,
  },
  reasonContentWrapper: {
    flex: 1,
  },
  reasonTitle: {
    color: "white",
    fontWeight: "600" as const,
    fontSize: 14,
    marginBottom: 2,
  },
  reasonSummary: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  reasonBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reasonDetailsSection: {
    marginTop: 10,
  },
  reasonBodyTitle: {
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  reasonBullet: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
  },
  shareCardSection: {
    marginTop: 24,
  },
  shareCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    backgroundColor: Colors.backgroundSecondary,
  },
  shareCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  shareCardBrand: {
    color: "white",
    fontWeight: "800" as const,
    fontSize: 18,
  },
  shareCardContent: {
    alignItems: "center",
    paddingVertical: 12,
  },
  shareCardBadge: {
    fontWeight: "800" as const,
    fontSize: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  shareCardScore: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 2,
  },
  shareCardDomain: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  shareCardFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: "center" as const,
  },
  newScanBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newScanBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  newScanText: {
    color: Colors.primary,
    fontWeight: "600" as const,
    fontSize: 15,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  modalCloseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  modalCloseBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  modalCloseText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: "center" as const,
    fontSize: 13,
  },
  errorText: {
    color: Colors.highRisk,
    marginTop: 8,
    textAlign: "center" as const,
    fontSize: 13,
  },
});
