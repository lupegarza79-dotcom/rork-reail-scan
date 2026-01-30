// app/(tabs)/index.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Settings, Shield, Clipboard as ClipboardIcon } from "lucide-react-native";
import Colors from "@/constants/colors";

export default function ScanHomeScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const cleanUrl = useMemo(() => input.trim(), [input]);

  const onPaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setInput(text.trim());
    } catch {
      // ignore
    }
  };

  const onScanNow = () => {
    Keyboard.dismiss();
    if (!cleanUrl) return;
    router.push(`/scanning?url=${encodeURIComponent(cleanUrl)}`);
  };

  const platforms = [
    { name: "TikTok", color: "#ff0050" },
    { name: "Instagram", color: "#E1306C" },
    { name: "Facebook", color: "#1877F2" },
    { name: "YouTube", color: "#FF0000" },
    { name: "News", color: "#6366F1" },
    { name: "Shop", color: "#10B981" },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <View style={styles.logoContainer}>
          <Shield size={20} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.logo}>REAiL</Text>
        </View>
        <Pressable 
          onPress={() => router.push("/settings")} 
          style={styles.settingsBtn}
        >
          <Settings size={22} color={Colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <Text style={styles.headline}>Verify any link</Text>
          <Text style={styles.subheadline}>in seconds</Text>
          <Text style={styles.tagline}>
            AI-powered detection for fake news, scams & misinformation
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused
          ]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste any link here…"
              placeholderTextColor={Colors.textTertiary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable 
              onPress={onPaste} 
              style={({ pressed }) => [
                styles.pasteBtn,
                pressed && styles.pasteBtnPressed
              ]}
            >
              <ClipboardIcon size={16} color="white" strokeWidth={2.5} />
              <Text style={styles.pasteText}>PASTE</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onScanNow}
            style={({ pressed }) => [
              styles.scanBtn,
              !cleanUrl && styles.scanBtnDisabled,
              pressed && cleanUrl && styles.scanBtnPressed
            ]}
            disabled={!cleanUrl}
          >
            <Shield size={18} color="white" strokeWidth={2.5} />
            <Text style={styles.scanText}>SCAN NOW</Text>
          </Pressable>
        </View>

        <View style={styles.platformsSection}>
          <Text style={styles.platformsLabel}>Works with</Text>
          <View style={styles.platformsRow}>
            {platforms.map((p) => (
              <View key={p.name} style={styles.platformChip}>
                <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                <Text style={styles.platformText}>{p.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable 
          onPress={() => router.push("/tools")} 
          style={({ pressed }) => [
            styles.moreLink,
            pressed && styles.moreLinkPressed
          ]}
        >
          <Text style={styles.moreLinkText}>More options</Text>
          <Text style={styles.moreLinkArrow}>→</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    color: "white",
    fontWeight: "800" as const,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  heroSection: {
    marginBottom: 32,
  },
  headline: {
    color: "white",
    fontSize: 36,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  subheadline: {
    color: Colors.primary,
    fontSize: 36,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    marginTop: -4,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
    lineHeight: 22,
  },
  inputSection: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingLeft: 16,
    paddingRight: 6,
    height: 58,
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundTertiary,
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 15,
    paddingVertical: 0,
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
  },
  pasteBtnPressed: {
    backgroundColor: Colors.cardHighlight,
  },
  pasteText: {
    color: "white",
    fontWeight: "700" as const,
    fontSize: 13,
  },
  scanBtn: {
    height: 58,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
  },
  scanBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  scanBtnDisabled: {
    backgroundColor: Colors.backgroundTertiary,
    opacity: 0.6,
  },
  scanText: {
    color: "white",
    fontWeight: "800" as const,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  platformsSection: {
    marginTop: 32,
  },
  platformsLabel: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  platformsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  platformText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  moreLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  moreLinkPressed: {
    opacity: 0.7,
  },
  moreLinkText: {
    color: Colors.primary,
    fontWeight: "600" as const,
    fontSize: 14,
  },
  moreLinkArrow: {
    color: Colors.primary,
    fontSize: 16,
  },
});
