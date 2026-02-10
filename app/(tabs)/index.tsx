// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lock, Shield, Clipboard as ClipboardIcon, Info, X, ChevronDown, ChevronUp, Upload } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";

const FIRST_SCAN_KEY = "reail_first_scan_shown";

export default function ScanHomeScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showFirstScanTip, setShowFirstScanTip] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advSaveHistory, setAdvSaveHistory] = useState(true);
  const [advCreateAlert, setAdvCreateAlert] = useState(true);
  const [advGenerateCase, setAdvGenerateCase] = useState(false);

  useEffect(() => {
    (async () => {
      const shown = await AsyncStorage.getItem(FIRST_SCAN_KEY);
      if (!shown) {
        setShowFirstScanTip(true);
      }
    })();
  }, []);

  const dismissFirstScanTip = async () => {
    setShowFirstScanTip(false);
    await AsyncStorage.setItem(FIRST_SCAN_KEY, "true");
  };

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

  const onUploadFile = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      router.push(`/scanning?mediaUri=${encodeURIComponent(uri)}`);
    } catch {}
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
        <View style={styles.settingsBtn}>
          <Lock size={14} color={Colors.textSecondary} strokeWidth={2.5} />
          <Text style={styles.privateText}>Private</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              placeholder="Paste a link, offer, or message…"
              multiline
              blurOnSubmit
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

          <View style={styles.altActionsRow}>
            <Pressable
              onPress={onUploadFile}
              style={({ pressed }) => [styles.altActionBtn, pressed && { opacity: 0.7 }]}
            >
              <Upload size={15} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.altActionText}>Upload file</Text>
            </Pressable>
            <View style={styles.altDivider} />
            <Pressable
              onPress={onPaste}
              style={({ pressed }) => [styles.altActionBtn, pressed && { opacity: 0.7 }]}
            >
              <ClipboardIcon size={15} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.altActionText}>Paste from clipboard</Text>
            </Pressable>
          </View>

          <Text style={styles.microcopy}>No login. Free. 30 seconds.</Text>
        </View>

        <Pressable
          onPress={() => setShowAdvanced(!showAdvanced)}
          style={({ pressed }) => [styles.advancedToggle, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.advancedToggleText}>Advanced</Text>
          {showAdvanced ? (
            <ChevronUp size={14} color={Colors.textTertiary} strokeWidth={2} />
          ) : (
            <ChevronDown size={14} color={Colors.textTertiary} strokeWidth={2} />
          )}
        </Pressable>

        {showAdvanced && (
          <View style={styles.advancedContent}>
            <View style={styles.advancedRow}>
              <Text style={styles.advancedLabel}>Save to History on this device</Text>
              <Switch
                value={advSaveHistory}
                onValueChange={setAdvSaveHistory}
                trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
                thumbColor="white"
              />
            </View>
            <View style={styles.advancedRow}>
              <Text style={styles.advancedLabel}>Create Watchlist alert if High Risk</Text>
              <Switch
                value={advCreateAlert}
                onValueChange={setAdvCreateAlert}
                trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
                thumbColor="white"
              />
            </View>
            <View style={[styles.advancedRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.advancedLabel}>Generate Money Case pack if I already paid</Text>
              <Switch
                value={advGenerateCase}
                onValueChange={setAdvGenerateCase}
                trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
                thumbColor="white"
              />
            </View>
          </View>
        )}

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

        <View style={styles.disclaimerRow}>
          <Info size={12} color={Colors.textTertiary} strokeWidth={2} />
          <Text style={styles.disclaimerText}>
            REAiL does not tell you what to believe—it shows signals and patterns.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showFirstScanTip}
        transparent
        animationType="fade"
        onRequestClose={dismissFirstScanTip}
      >
        <Pressable style={styles.modalOverlay} onPress={dismissFirstScanTip}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Shield size={24} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.modalTitle}>Welcome to REAiL</Text>
              <Pressable onPress={dismissFirstScanTip} style={styles.modalCloseIcon}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
            
            <View style={styles.tipsList}>
              <View style={styles.tipRow}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>1</Text>
                </View>
                <Text style={styles.tipText}>
                  REAiL analyzes public signals—it does not access private data.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>2</Text>
                </View>
                <Text style={styles.tipText}>
                  Results are risk-based, not absolute truth. Always use context.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>3</Text>
                </View>
                <Text style={styles.tipText}>
                  Lack of evidence ≠ scam. Verified ≠ endorsement.
                </Text>
              </View>
            </View>

            <Pressable 
              style={({ pressed }) => [styles.modalBtn, pressed && styles.modalBtnPressed]} 
              onPress={dismissFirstScanTip}
            >
              <Text style={styles.modalBtnText}>Got it, scan now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
  },
  privateText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
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
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  disclaimerText: {
    flex: 1,
    color: Colors.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
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
    gap: 12,
    marginBottom: 20,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    color: Colors.text,
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
  tipsList: {
    gap: 14,
    marginBottom: 20,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  tipBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tipBulletText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700" as const,
  },
  tipText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  modalBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  modalBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  modalBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  altActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 2,
  },
  altActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  altActionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  altDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
  },
  microcopy: {
    color: Colors.textTertiary,
    fontSize: 12,
    textAlign: "center" as const,
    marginTop: 4,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 20,
  },
  advancedToggleText: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  advancedContent: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  advancedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  advancedLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    marginRight: 12,
  },
});
