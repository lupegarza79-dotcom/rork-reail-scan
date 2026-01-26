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

export default function ScanHomeScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");

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

  const chips = ["TikTok", "Instagram", "Facebook", "YouTube", "News", "Shop"];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Text style={styles.logo}>REAiL</Text>
        <Text style={styles.title}>Scan</Text>
        <Pressable onPress={() => router.push("/settings")} style={styles.topBtn}>
          <Text style={styles.topBtnText}>⚙️</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.headline}>Paste a link. Know if it's real.</Text>
        <Text style={styles.subhead}>
          TikTok • Instagram • Facebook • YouTube • News • Shops
        </Text>

        <View style={styles.spacer14} />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Paste any link here…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={onPaste} style={styles.pasteBtn}>
            <Text style={styles.pasteText}>PASTE</Text>
          </Pressable>
        </View>

        <View style={styles.spacer12} />

        <Pressable
          onPress={onScanNow}
          style={[styles.scanBtn, !cleanUrl && styles.scanBtnDisabled]}
          disabled={!cleanUrl}
        >
          <Text style={styles.scanText}>SCAN NOW</Text>
        </Pressable>

        <View style={styles.spacer14} />

        <View style={styles.chipsRow}>
          {chips.map((c) => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer14} />

        <Pressable onPress={() => router.push("/tools")} style={styles.moreLink}>
          <Text style={styles.moreLinkText}>More options →</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0c10",
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  logo: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  title: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
    opacity: 0.9,
  },
  topBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnText: {
    color: "white",
    fontSize: 16,
    opacity: 0.9,
  },
  content: {
    padding: 16,
  },
  headline: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  subhead: {
    color: "white",
    opacity: 0.7,
    marginTop: 6,
  },
  spacer14: {
    height: 14,
  },
  spacer12: {
    height: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pasteBtn: {
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pasteText: {
    color: "white",
    fontWeight: "900",
    opacity: 0.9,
  },
  scanBtn: {
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,180,255,0.28)",
    borderWidth: 1,
    borderColor: "rgba(120,180,255,0.35)",
  },
  scanBtnDisabled: {
    opacity: 0.5,
  },
  scanText: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "nowrap",
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
  },
  chipText: {
    color: "white",
    opacity: 0.8,
    fontWeight: "700",
    fontSize: 12,
  },
  moreLink: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  moreLinkText: {
    color: "rgba(120,180,255,0.9)",
    fontWeight: "700",
    fontSize: 14,
  },
});
