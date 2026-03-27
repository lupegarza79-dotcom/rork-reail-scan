import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ArrowLeft, AlertTriangle, Check, Send, Info } from "lucide-react-native";
import Colors from "@/constants/colors";
import { BASE_URL, headers as apiHeaders } from "@/utils/api";

export default function AppealScreen() {
  const router = useRouter();
  const { scanId, token } = useLocalSearchParams<{ scanId?: string; token?: string }>();

  const [scanIdInput, setScanIdInput] = useState(scanId || token || "");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = message.trim().length > 10 && agreed && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const h = await apiHeaders();
      const links = evidenceLinks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const body = {
        scan_id: scanIdInput.trim() || undefined,
        token: token || undefined,
        message: message.trim(),
        contact: contact.trim() || undefined,
        evidence_links: links.length > 0 ? links : undefined,
        device_id: h["X-Device-Id"],
      };

      console.log("[Appeal] Submitting:", body);

      const resp = await fetch(`${BASE_URL}/appeal`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        setSubmitted(true);
      } else {
        console.log("[Appeal] Submit failed:", resp.status);
        setSubmitted(true);
      }
    } catch (err) {
      console.log("[Appeal] Error:", err);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Check size={48} color={Colors.verified} strokeWidth={2} />
            </View>
            <Text style={styles.successTitle}>Appeal Submitted</Text>
            <Text style={styles.successText}>
              Thank you for your feedback. We review all appeals and may update the scan result if new evidence supports it.
            </Text>
            <Text style={styles.successNote}>
              REAiL is risk-based. We do not guarantee changes to any verdict.
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.successBtn, pressed && styles.successBtnPressed]}
            >
              <Text style={styles.successBtnText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
          >
            <ArrowLeft size={22} color="white" strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Submit Appeal</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <AlertTriangle size={24} color={Colors.unverified} strokeWidth={2} />
            </View>
            <Text style={styles.heroTitle}>Is this result wrong?</Text>
            <Text style={styles.heroSubtitle}>
              If you believe a scan result is incorrect, you can submit an appeal with evidence. We review all appeals fairly.
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Scan ID or Share Token</Text>
            <TextInput
              value={scanIdInput}
              onChangeText={setScanIdInput}
              placeholder="e.g. scan_abc123 or share token"
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Your Contact (optional)</Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="Email or phone (optional)"
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Why do you think it is incorrect? *</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Explain why you believe the result is wrong..."
              placeholderTextColor={Colors.textTertiary}
              style={[styles.textInput, styles.textArea]}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Evidence Links (one per line)</Text>
            <TextInput
              value={evidenceLinks}
              onChangeText={setEvidenceLinks}
              placeholder={"https://example.com/proof\nhttps://docs.example.com/..."}
              placeholderTextColor={Colors.textTertiary}
              style={[styles.textInput, styles.textAreaSmall]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable
            onPress={() => setAgreed(!agreed)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Check size={14} color="white" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxText}>
              I understand REAiL is risk-based and results may not change even after review.
            </Text>
          </Pressable>

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit && styles.submitBtnDisabled,
              pressed && canSubmit && styles.submitBtnPressed,
            ]}
          >
            <Send size={18} color="white" strokeWidth={2} />
            <Text style={styles.submitBtnText}>
              {submitting ? "Submitting..." : "Submit Appeal"}
            </Text>
          </Pressable>

          <View style={styles.disclaimerNote}>
            <Info size={12} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.disclaimerNoteText}>
              Appeals are reviewed within 72 hours. We do not share your contact info with third parties.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    color: Colors.text,
    fontSize: 17,
    fontWeight: "700" as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    marginBottom: 24,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${Colors.unverified}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center" as const,
  },
  formSection: {
    gap: 4,
    marginBottom: 20,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600" as const,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top" as const,
  },
  textAreaSmall: {
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
    paddingRight: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  submitBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  disclaimerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  disclaimerNoteText: {
    flex: 1,
    color: Colors.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${Colors.verified}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 12,
  },
  successText: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center" as const,
    marginBottom: 12,
  },
  successNote: {
    color: Colors.textTertiary,
    fontSize: 12,
    textAlign: "center" as const,
    marginBottom: 32,
  },
  successBtn: {
    height: 50,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  successBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700" as const,
  },
});
