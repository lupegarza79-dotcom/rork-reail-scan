// app/scanning.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Shield, Wifi, WifiOff } from "lucide-react-native";
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
  const [statusText, setStatusText] = useState<string>("Analyzing");
  const [step, setStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const didRunRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 8000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pulseAnim, rotateAnim, progressAnim]);

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

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '95%'],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.animationContainer}>
            <Animated.View 
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }] }
              ]}
            />
            <Animated.View 
              style={[
                styles.rotatingRing,
                { transform: [{ rotate: spin }] }
              ]}
            />
            <View style={styles.iconCircle}>
              <Shield size={40} color={Colors.primary} strokeWidth={2} />
            </View>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.stepText}>{steps[step]}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
            </View>
            <View style={styles.stepsIndicator}>
              {steps.map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.stepDot,
                    i <= step && styles.stepDotActive
                  ]} 
                />
              ))}
            </View>
          </View>

          <View style={styles.statusBadge}>
            {isOnline ? (
              <Wifi size={14} color={Colors.verified} strokeWidth={2.5} />
            ) : (
              <WifiOff size={14} color={Colors.highRisk} strokeWidth={2.5} />
            )}
            <Text style={styles.statusLabel}>
              {isOnline ? "Connected" : "Offline mode"}
            </Text>
          </View>

          {!!error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable 
                onPress={() => router.replace("/")} 
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && styles.backBtnPressed
                ]}
              >
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
    padding: 24,
  },
  animationContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primaryGlow,
    opacity: 0.3,
  },
  rotatingRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: Colors.primary,
    borderRightColor: Colors.primaryLight,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  statusText: {
    fontSize: 28,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    color: "white",
    marginBottom: 8,
  },
  stepText: {
    textAlign: "center" as const,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  progressContainer: {
    width: "100%",
    maxWidth: 280,
    marginBottom: 32,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  stepsIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.backgroundTertiary,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "500" as const,
  },
  errorContainer: {
    marginTop: 32,
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    textAlign: "center" as const,
    color: Colors.highRisk,
    fontSize: 14,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  backBtnText: {
    fontWeight: "600" as const,
    color: "white",
    fontSize: 15,
  },
});
