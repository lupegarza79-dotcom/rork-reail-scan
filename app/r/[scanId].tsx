import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { fetchScanResultById } from "../../utils/api";
import { APP_SCHEME } from "../../utils/deepLinking";

export default function WebResultFallback() {
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const id = useMemo(() => String(scanId || ""), [scanId]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const disclaimer =
    "REAiL provides risk-based verification using public signals and automated analysis. It does not claim absolute truth.";

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetchScanResultById(id);
      if (!active) return;
      setData(res);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const openInApp = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = `${APP_SCHEME}://result?scanId=${encodeURIComponent(id)}`;
    } else {
      router.push({ pathname: "/result", params: { scanId: id } });
    }
  };

  const copyLink = async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      await Clipboard.setStringAsync(window.location.href);
    } else {
      const link = `https://reail.app/r/${encodeURIComponent(id)}`;
      await Clipboard.setStringAsync(link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scanAnother = () => {
    router.push("/");
  };

  const getBadgeEmoji = (badge: string) => {
    if (badge === "VERIFIED") return "✅";
    if (badge === "HIGH_RISK") return "❌";
    return "⚠️";
  };

  const getBadgeColor = (badge: string) => {
    if (badge === "VERIFIED") return "rgba(80, 200, 120, 0.2)";
    if (badge === "HIGH_RISK") return "rgba(255, 90, 90, 0.2)";
    return "rgba(255, 180, 50, 0.2)";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>REAiL</Text>
        <Text style={styles.headerSub}>Scan</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Shared Result</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : !data ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Could not load this result. Try again later.
            </Text>
            <Pressable onPress={scanAnother} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>SCAN ANOTHER</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.badgeRow, { backgroundColor: getBadgeColor(data.badge) }]}>
              <Text style={styles.badgeEmoji}>{getBadgeEmoji(data.badge)}</Text>
              <Text style={styles.badgeText}>{data.badge}</Text>
            </View>

            <Text style={styles.domain}>{data.domain || "unknown"}</Text>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Trust Score</Text>
              <Text style={styles.scoreValue}>{data.score}/100</Text>
            </View>

            {data.title && (
              <Text style={styles.titleText} numberOfLines={2}>
                {data.title}
              </Text>
            )}

            <View style={styles.divider} />

            <Text style={styles.disclaimer}>{disclaimer}</Text>

            <View style={styles.buttonsContainer}>
              <Pressable onPress={openInApp} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>OPEN IN APP</Text>
              </Pressable>

              <View style={styles.rowBtns}>
                <Pressable onPress={copyLink} style={styles.halfBtn}>
                  <Text style={styles.halfBtnText}>
                    {copied ? "COPIED!" : "COPY LINK"}
                  </Text>
                </Pressable>

                <Pressable onPress={scanAnother} style={styles.halfBtn}>
                  <Text style={styles.halfBtnText}>SCAN ANOTHER</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
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
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  logo: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 16,
  },
  headerSub: {
    color: "white",
    fontWeight: "800" as const,
    fontSize: 16,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "900" as const,
    marginBottom: 16,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "white",
    opacity: 0.7,
  },
  errorBox: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,90,90,0.3)",
    backgroundColor: "rgba(255,90,90,0.1)",
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    color: "#ff7070",
    textAlign: "center",
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeEmoji: {
    fontSize: 18,
  },
  badgeText: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 14,
  },
  domain: {
    color: "white",
    fontSize: 18,
    fontWeight: "800" as const,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scoreLabel: {
    color: "white",
    opacity: 0.7,
    fontSize: 14,
  },
  scoreValue: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 20,
  },
  titleText: {
    color: "white",
    opacity: 0.75,
    fontSize: 13,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 12,
  },
  disclaimer: {
    color: "white",
    opacity: 0.6,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  buttonsContainer: {
    gap: 10,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,180,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(120,180,255,0.35)",
  },
  primaryText: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 14,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 20,
  },
  secondaryText: {
    color: "white",
    fontWeight: "900" as const,
    opacity: 0.9,
    fontSize: 13,
  },
  rowBtns: {
    flexDirection: "row",
    gap: 10,
  },
  halfBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  halfBtnText: {
    color: "white",
    fontWeight: "900" as const,
    opacity: 0.9,
    fontSize: 12,
  },
});
