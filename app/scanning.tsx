// app/scanning.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { scanService } from "../utils/scanService";
import { useNetwork } from "../hooks/useNetwork";
import Colors from "@/constants/colors";

type Params = {
  url?: string;
  mediaUri?: string;
};

export default function ScanningScreen() {
  const router = useRouter();
  const { url, mediaUri } = useLocalSearchParams<Params>();

  const { isConnected: isOnline } = useNetwork();
  const [statusText, setStatusText] = useState<string>("Scanning…");
  const [step, setStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const didRunRef = useRef(false);

  const steps = useMemo(
    () => [
      "Checking media integrity…",
      "Checking claims…",
      "Checking source signals…",
      "Checking link safety…",
      "Generating explainable reasons (A–F)…",
    ],
    []
  );

  // Determine scan input
  const scanInput = useMemo(() => {
    const cleanUrl = typeof url === "string" ? url.trim() : "";
    const cleanMedia = typeof mediaUri === "string" ? mediaUri.trim() : "";
    return {
      url: cleanUrl.length ? cleanUrl : undefined,
      mediaUri: cleanMedia.length ? cleanMedia : undefined,
    };
  }, [url, mediaUri]);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const run = async () => {
      try {
        setError(null);

        // show online/offline as UI only (not "AI connected")
        if (!isOnline) {
          setStatusText("Offline mode (fallback)");
        }

        // Basic progress loop
        let i = 0;
        const interval = setInterval(() => {
          i = (i + 1) % steps.length;
          setStep(i);
        }, 800);

        let result: any;

        if (scanInput.url) {
          result = await scanService.scanUrl({ url: scanInput.url });
        } else if (scanInput.mediaUri) {
          result = await scanService.scanMedia({ mediaUri: scanInput.mediaUri });
        } else {
          clearInterval(interval);
          setError("No URL or screenshot provided.");
          return;
        }

        clearInterval(interval);

        // Route to result - check for id (canonical) or scanId
        const scanIdToUse = result?.id || result?.scanId;
        if (scanIdToUse) {
          router.replace(`/result?scanId=${encodeURIComponent(scanIdToUse)}`);
        } else {
          // fallback: pass payload directly (encoded JSON)
          const encoded = encodeURIComponent(JSON.stringify(result ?? {}));
          router.replace(`/result?payload=${encoded}`);
        }
      } catch (e: any) {
        setError(e?.message || "Scan failed. Please try again.");
      }
    };

    run();
  }, [isOnline, router, scanInput, steps]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>REAiL</Text>
          </View>

          <Text style={styles.statusText}>{statusText}</Text>

          <View style={styles.spacer} />

          <ActivityIndicator size="large" color={Colors.primary} />

          <View style={styles.spacer} />

          <Text style={styles.stepText}>{steps[step]}</Text>

          <View style={styles.spacer} />

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.verified : Colors.highRisk }]} />
            <Text style={styles.statusLabel}>
              {isOnline ? "Online" : "Offline"} • Risk-based verification
            </Text>
          </View>

          {!!error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>

              <View style={styles.spacerSmall} />

              <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Back to Scan</Text>
              </Pressable>
            </View>
          )}
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoContainer: {
    marginBottom: 32,
  },
  logo: {
    color: "white",
    fontWeight: "900" as const,
    fontSize: 28,
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "700" as const,
    textAlign: "center",
    color: "white",
  },
  spacer: {
    height: 24,
  },
  spacerSmall: {
    height: 12,
  },
  stepText: {
    textAlign: "center",
    color: "white",
    opacity: 0.85,
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: "white",
    opacity: 0.7,
    fontSize: 12,
  },
  errorContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  errorText: {
    textAlign: "center",
    color: Colors.highRisk,
    fontSize: 14,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  backBtnText: {
    fontWeight: "700" as const,
    color: "white",
  },
});
