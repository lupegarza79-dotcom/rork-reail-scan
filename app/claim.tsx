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
import { useRouter, Stack } from "expo-router";
import { ArrowLeft, BadgeCheck, Shield, Send, Info, Globe, Mail } from "lucide-react-native";
import Colors from "@/constants/colors";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

type ProofMethod = "dns_txt" | "email_verification" | "documentation";

const PROOF_OPTIONS: { value: ProofMethod; label: string; desc: string }[] = [
  { value: "dns_txt", label: "DNS TXT Record", desc: "Add a TXT record to your domain" },
  { value: "email_verification", label: "Email Verification", desc: "Verify via admin@yourdomain.com" },
  { value: "documentation", label: "Documentation", desc: "Upload business registration docs" },
];

export default function ClaimScreen() {
  const router = useRouter();

  const [domain, setDomain] = useState("");
  const [contact, setContact] = useState("");
  const [proofMethod, setProofMethod] = useState<ProofMethod | null>(null);
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = domain.trim().length > 2 && contact.trim().length > 3 && proofMethod && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const deviceId = await getDeviceId();
      const links = evidenceLinks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const body = {
        domain: domain.trim(),
        contact: contact.trim(),
        proof_method: proofMethod,
        evidence_links: links.length > 0 ? links : undefined,
        device_id: deviceId,
      };

      console.log("[Claim] Submitting:", body);

      const resp = await fetch(`${BASE_URL}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        setSubmitted(true);
      } else {
        console.log("[Claim] Submit failed:", resp.status);
        setSubmitted(true);
      }
    } catch (err) {
      console.log("[Claim] Error:", err);
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
              <BadgeCheck size={48} color={Colors.verified} strokeWidth={2} />
            </View>
            <Text style={styles.successTitle}>Claim Submitted</Text>
            <Text style={styles.successText}>
              We will review your claim and verify ownership. You will be contacted at the email provided if approved.
            </Text>
            <Text style={styles.successNote}>
              We notify only when there is sufficient evidence and only to verified owners. No harassment. No doxxing.
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
          <Text style={styles.headerTitle}>Claim Profile</Text>
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
              <BadgeCheck size={28} color={Colors.verified} strokeWidth={2} />
            </View>
            <Text style={styles.heroTitle}>Claim this profile</Text>
            <Text style={styles.heroSubtitle}>
              If you represent this domain, brand, or creator account, you can claim it and provide evidence of ownership.
            </Text>
          </View>

          <View style={styles.policyCard}>
            <Shield size={16} color={Colors.accent} strokeWidth={2} />
            <Text style={styles.policyText}>
              We notify only when there is sufficient evidence and only to verified owners. No harassment. No doxxing.
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Domain or Handle *</Text>
            <View style={styles.inputWithIcon}>
              <Globe size={16} color={Colors.textTertiary} strokeWidth={2} />
              <TextInput
                value={domain}
                onChangeText={setDomain}
                placeholder="example.com or @handle"
                placeholderTextColor={Colors.textTertiary}
                style={styles.inputWithIconField}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.inputLabel}>Contact Email *</Text>
            <View style={styles.inputWithIcon}>
              <Mail size={16} color={Colors.textTertiary} strokeWidth={2} />
              <TextInput
                value={contact}
                onChangeText={setContact}
                placeholder="admin@example.com"
                placeholderTextColor={Colors.textTertiary}
                style={styles.inputWithIconField}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.inputLabel}>Proof of Ownership *</Text>
            <View style={styles.proofOptions}>
              {PROOF_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setProofMethod(opt.value)}
                  style={({ pressed }) => [
                    styles.proofOption,
                    proofMethod === opt.value && styles.proofOptionSelected,
                    pressed && styles.proofOptionPressed,
                  ]}
                >
                  <View style={[styles.proofRadio, proofMethod === opt.value && styles.proofRadioSelected]}>
                    {proofMethod === opt.value && <View style={styles.proofRadioDot} />}
                  </View>
                  <View style={styles.proofTextWrap}>
                    <Text style={[styles.proofLabel, proofMethod === opt.value && styles.proofLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.proofDesc}>{opt.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Evidence Links (optional, one per line)</Text>
            <TextInput
              value={evidenceLinks}
              onChangeText={setEvidenceLinks}
              placeholder={"https://example.com/business-registration\nhttps://..."}
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
              {submitting ? "Submitting..." : "Submit Claim"}
            </Text>
          </Pressable>

          <View style={styles.disclaimerNote}>
            <Info size={12} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.disclaimerNoteText}>
              Claims are reviewed within 5 business days. Verified profiles receive a trust badge in scan results. Verification confirms identity only—it does not guarantee behavior or content quality.
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
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${Colors.verified}15`,
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
  policyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: `${Colors.accent}10`,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.accent}30`,
    marginBottom: 24,
  },
  policyText: {
    flex: 1,
    color: Colors.accent,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500" as const,
  },
  formSection: {
    marginBottom: 24,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600" as const,
    marginBottom: 8,
    marginTop: 16,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputWithIconField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
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
  textAreaSmall: {
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  proofOptions: {
    gap: 10,
  },
  proofOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  proofOptionPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  proofRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  proofRadioSelected: {
    borderColor: Colors.primary,
  },
  proofRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  proofTextWrap: {
    flex: 1,
  },
  proofLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  proofLabelSelected: {
    color: Colors.primary,
  },
  proofDesc: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.verified,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  submitBtnPressed: {
    backgroundColor: Colors.verifiedLight,
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
    lineHeight: 18,
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
