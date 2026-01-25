// app/scanning.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { scanService } from "../utils/scanService";
import { useNetwork } from "../hooks/useNetwork";

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

        // Must contain scanId or minimum payload to render result
        // Route to result with serialized payload if scanId missing
        if (result?.scanId) {
          router.replace(`/result?scanId=${encodeURIComponent(result.scanId)}`);
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
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", textAlign: "center" }}>
        {statusText}
      </Text>

      <View style={{ height: 18 }} />

      <ActivityIndicator size="large" />

      <View style={{ height: 18 }} />

      <Text style={{ textAlign: "center", opacity: 0.85 }}>
        {steps[step]}
      </Text>

      <View style={{ height: 18 }} />

      <Text style={{ textAlign: "center", opacity: 0.6, fontSize: 12 }}>
        {isOnline ? "Online" : "Offline"} • Risk-based verification
      </Text>

      {!!error && (
        <View style={{ marginTop: 18 }}>
          <Text style={{ textAlign: "center", color: "tomato" }}>{error}</Text>

          <View style={{ height: 12 }} />

          <Pressable
            onPress={() => router.replace("/")}
            style={{
              alignSelf: "center",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ fontWeight: "600" }}>Back to Scan</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
