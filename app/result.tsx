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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as WebBrowser from "expo-web-browser";
import { getCachedScanResult } from "../utils/scanCache";

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
  if (badge === "VERIFIED") return "✅ VERIFIED";
  if (badge === "UNVERIFIED") return "⚠️ UNVERIFIED";
  return "❌ HIGH RISK";
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
        if (active && found) setCached(found);
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
    lines.push("");
    lines.push("Why (A–F):");
    (["A", "B", "C", "D", "E", "F"] as ReasonKey[]).forEach((k) => {
      const item = reasonsMerged[k];
      lines.push(`${k}) ${item.title}: ${item.summary}`);
    });
    lines.push("");
    lines.push(shareCardFooter);

    await Share.share({ message: lines.join("\n") });
  };

  const onShareImage = async () => {
    try {
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
      });
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri }
          : { message: shareCardFooter, url: uri }
      );
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Result</Text>
        <Pressable onPress={onShareText} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Share</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.domainText}>{domain}</Text>

          <View style={styles.spacer10} />

          <Text style={styles.badgeText}>{badgeLabel(badge)}</Text>
          <Text style={styles.scoreText}>Trust Score: {score}</Text>

          <Pressable onPress={() => setDisclaimerOpen(true)} style={styles.disclaimerPill}>
            <Text style={styles.disclaimerPillText}>
              {disclaimerShort} <Text style={styles.disclaimerInfoIcon}>ⓘ</Text>
            </Text>
          </Pressable>

          <View style={styles.spacer10} />
          <Text style={styles.verdictText}>{badgeHint(badge)}</Text>

          {!!result.url && (
            <Pressable onPress={onOpenLink} style={styles.openLinkBtn}>
              <Text style={styles.openLinkText}>Open scanned link</Text>
            </Pressable>
          )}

          <View style={styles.spacer14} />

          <View style={styles.actionsRow}>
            <Pressable onPress={() => router.replace("/")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
            <Pressable onPress={onShareText} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>SHARE REPORT</Text>
            </Pressable>
          </View>

          <Pressable onPress={onShareImage} style={styles.shareImageBtn}>
            <Text style={styles.shareImageText}>SHARE AS IMAGE</Text>
          </Pressable>

          <View style={styles.spacer10} />
          <Text style={styles.footerDisclaimer}>{shareCardFooter}</Text>
        </View>

        <View style={styles.spacer14} />

        <Text style={styles.sectionTitle}>Why (A–F)</Text>

        {(Object.keys(reasonsMerged) as ReasonKey[]).map((k) => {
          const item = reasonsMerged[k];
          const isOpen = expanded[k];
          return (
            <View key={k} style={styles.reasonCard}>
              <Pressable onPress={() => toggleExpand(k)} style={styles.reasonHeader}>
                <Text style={styles.reasonKey}>{k}</Text>
                <View style={styles.reasonContentWrapper}>
                  <Text style={styles.reasonTitle}>{item.title}</Text>
                  <Text style={styles.reasonSummary}>{item.summary}</Text>
                </View>
                <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
              </Pressable>

              {isOpen && (
                <View style={styles.reasonBody}>
                  {!!item.details?.length && (
                    <>
                      <Text style={styles.reasonBodyTitle}>Details</Text>
                      {item.details.map((d, i) => (
                        <Text key={i} style={styles.reasonBullet}>• {d}</Text>
                      ))}
                    </>
                  )}

                  {!!item.whatWouldVerify?.length && (
                    <>
                      <View style={styles.spacer10} />
                      <Text style={styles.reasonBodyTitle}>What would verify this?</Text>
                      {item.whatWouldVerify.map((d, i) => (
                        <Text key={i} style={styles.reasonBullet}>• {d}</Text>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.spacer18} />

        <View style={styles.shareCardWrapper}>
          <Text style={styles.sectionTitle}>Share Card</Text>

          <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
            <Text style={styles.shareCardHeadline}>REAiL Scan Result</Text>
            <Text style={styles.shareCardBadge}>{badgeLabel(badge)}</Text>
            <Text style={styles.shareCardMeta}>Score: {score}/100</Text>
            <Text style={styles.shareCardMeta}>Domain: {domain}</Text>
            <Text style={styles.shareCardFooter}>{shareCardFooter}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={disclaimerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDisclaimerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDisclaimerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Verification disclaimer</Text>
            <Text style={styles.modalBody}>{disclaimerFull}</Text>

            <Pressable style={styles.modalCloseBtn} onPress={() => setDisclaimerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
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
    backgroundColor: "#0b0c10",
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    color: "white",
    fontSize: 14,
    opacity: 0.9,
  },
  headerTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700" as const,
    opacity: 0.95,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  domainText: {
    color: "white",
    opacity: 0.8,
    fontSize: 12,
  },
  badgeText: {
    color: "white",
    fontSize: 22,
    fontWeight: "800" as const,
  },
  scoreText: {
    color: "white",
    opacity: 0.9,
    marginTop: 6,
    fontSize: 14,
  },
  disclaimerPill: {
    marginTop: 8,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  disclaimerPillText: {
    color: "white",
    fontSize: 12,
    opacity: 0.85,
  },
  disclaimerInfoIcon: {
    color: "white",
    opacity: 0.9,
  },
  verdictText: {
    color: "white",
    opacity: 0.75,
    marginTop: 4,
    fontSize: 13,
    textAlign: "center",
  },
  openLinkBtn: {
    marginTop: 12,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  openLinkText: {
    color: "white",
    fontWeight: "700" as const,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(120,180,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(120,180,255,0.35)",
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "800" as const,
  },
  secondaryBtn: {
    width: 90,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  secondaryBtnText: {
    color: "white",
    fontWeight: "700" as const,
    opacity: 0.9,
  },
  shareImageBtn: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  shareImageText: {
    color: "white",
    fontWeight: "800" as const,
    opacity: 0.95,
  },
  footerDisclaimer: {
    color: "white",
    opacity: 0.65,
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
  },
  sectionTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "800" as const,
    marginBottom: 8,
    opacity: 0.9,
  },
  reasonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 10,
    overflow: "hidden",
  },
  reasonHeader: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    alignItems: "center",
  },
  reasonKey: {
    color: "white",
    fontWeight: "900" as const,
    width: 18,
    opacity: 0.9,
  },
  reasonContentWrapper: {
    flex: 1,
  },
  reasonTitle: {
    color: "white",
    fontWeight: "800" as const,
    marginBottom: 2,
  },
  reasonSummary: {
    color: "white",
    opacity: 0.75,
    fontSize: 12,
  },
  chevron: {
    color: "white",
    opacity: 0.7,
    fontSize: 16,
  },
  reasonBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  reasonBodyTitle: {
    color: "white",
    fontWeight: "800" as const,
    opacity: 0.9,
    marginTop: 8,
  },
  reasonBullet: {
    color: "white",
    opacity: 0.78,
    fontSize: 12,
    marginTop: 4,
  },
  shareCardWrapper: {
    marginTop: 4,
  },
  shareCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  shareCardHeadline: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 16,
    marginBottom: 8,
  },
  shareCardBadge: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 18,
    marginBottom: 6,
  },
  shareCardMeta: {
    color: "white",
    opacity: 0.85,
    fontSize: 12,
    marginBottom: 3,
  },
  shareCardFooter: {
    marginTop: 10,
    fontSize: 10,
    opacity: 0.75,
    color: "white",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: "rgba(20,20,22,1)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800" as const,
    marginBottom: 8,
  },
  modalBody: {
    color: "white",
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
    marginBottom: 12,
  },
  modalCloseBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalCloseText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800" as const,
  },
  spacer10: {
    height: 10,
  },
  spacer14: {
    height: 14,
  },
  spacer18: {
    height: 18,
  },
});
