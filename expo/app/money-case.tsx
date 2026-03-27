import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  FileText,
  Check,
  Copy,
} from "lucide-react-native";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import { createMoneyCase } from "@/utils/api";
import type { MoneyCaseIssue, PaymentMethodType, DesiredOutcome, RailPack } from "@/types/scan";

const ISSUE_OPTIONS: { value: MoneyCaseIssue; label: string }[] = [
  { value: "scam_fraud", label: "Scam / Fraud" },
  { value: "unauthorized_charge", label: "Unauthorized Charge" },
  { value: "product_not_received", label: "Product Not Received" },
  { value: "product_not_as_described", label: "Not as Described" },
  { value: "duplicate_charge", label: "Duplicate Charge" },
  { value: "subscription_cancellation", label: "Subscription Issue" },
  { value: "refund_not_processed", label: "Refund Not Processed" },
  { value: "other", label: "Other" },
];

const PAYMENT_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "paypal", label: "PayPal" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "cash_app", label: "Cash App" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "google_pay", label: "Google Pay" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "crypto", label: "Crypto" },
  { value: "gift_card", label: "Gift Card" },
  { value: "other", label: "Other" },
];

const OUTCOME_OPTIONS: { value: DesiredOutcome; label: string }[] = [
  { value: "full_refund", label: "Full Refund" },
  { value: "partial_refund", label: "Partial Refund" },
  { value: "chargeback", label: "Chargeback" },
  { value: "replacement", label: "Replacement" },
  { value: "store_credit", label: "Store Credit" },
  { value: "other", label: "Other" },
];

export default function MoneyCaseScreen() {
  const router = useRouter();
  const { domain, url } = useLocalSearchParams<{
    domain?: string;
    url?: string;
    scanId?: string;
  }>();

  const [step, setStep] = useState(0);
  const [issueType, setIssueType] = useState<MoneyCaseIssue | null>(null);
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [merchantName, setMerchantName] = useState(domain || "");
  const [description, setDescription] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState<DesiredOutcome | null>(null);
  const [railPack, setRailPack] = useState<RailPack | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const createCaseMutation = useMutation({
    mutationFn: createMoneyCase,
    onSuccess: (response) => {
      if (response?.rail_pack) {
        setRailPack(response.rail_pack);
        setStep(7);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    },
  });

  const { mutate: submitCase } = createCaseMutation;

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return !!issueType;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return !!desiredOutcome;
      default: return false;
    }
  }, [step, issueType, desiredOutcome]);

  const handleSubmit = useCallback(() => {
    if (!issueType) return;
    const amountCents = amount ? Math.round(parseFloat(amount.replace(/[^0-9.]/g, "")) * 100) : undefined;

    submitCase({
      issue_type: issueType,
      amount_cents: amountCents,
      currency: "USD",
      transaction_date: transactionDate || undefined,
      payment_method: paymentMethod || undefined,
      merchant_name: merchantName || undefined,
      merchant_url: url || undefined,
      description: description || undefined,
      desired_outcome: desiredOutcome || undefined,
      locale: "en",
    });
  }, [issueType, amount, transactionDate, paymentMethod, merchantName, url, description, desiredOutcome, submitCase]);

  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      console.log("[MoneyCase] Copy error");
    }
  }, []);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What happened?</Text>
            <Text style={styles.stepSubtitle}>Select the issue type</Text>
            <View style={styles.optionsGrid}>
              {ISSUE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setIssueType(opt.value)}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    issueType === opt.value && styles.optionBtnSelected,
                    pressed && styles.optionBtnPressed,
                  ]}
                >
                  <Text style={[styles.optionText, issueType === opt.value && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Amount & Date</Text>
            <Text style={styles.stepSubtitle}>Optional but helps your case</Text>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="$0.00"
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>Transaction Date</Text>
            <TextInput
              value={transactionDate}
              onChangeText={setTransactionDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Payment Method</Text>
            <Text style={styles.stepSubtitle}>How did you pay?</Text>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionsGrid}>
                {PAYMENT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPaymentMethod(opt.value)}
                    style={({ pressed }) => [
                      styles.optionBtn,
                      paymentMethod === opt.value && styles.optionBtnSelected,
                      pressed && styles.optionBtnPressed,
                    ]}
                  >
                    <Text style={[styles.optionText, paymentMethod === opt.value && styles.optionTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Merchant / Site</Text>
            <Text style={styles.stepSubtitle}>Where did you make the purchase?</Text>
            <Text style={styles.fieldLabel}>Merchant Name</Text>
            <TextInput
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="e.g. ShopXYZ"
              placeholderTextColor={Colors.textTertiary}
              style={styles.textInput}
            />
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What happened?</Text>
            <Text style={styles.stepSubtitle}>Describe the situation</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what happened..."
              placeholderTextColor={Colors.textTertiary}
              style={[styles.textInput, styles.textArea]}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Desired Outcome</Text>
            <Text style={styles.stepSubtitle}>What resolution do you want?</Text>
            <View style={styles.optionsGrid}>
              {OUTCOME_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setDesiredOutcome(opt.value)}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    desiredOutcome === opt.value && styles.optionBtnSelected,
                    pressed && styles.optionBtnPressed,
                  ]}
                >
                  <Text style={[styles.optionText, desiredOutcome === opt.value && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  if (step === 7 && railPack) {
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
            <Text style={styles.headerTitle}>Your Rail Pack</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.packContent} showsVerticalScrollIndicator={false}>
          <View style={styles.packSuccessCard}>
            <View style={styles.packSuccessIcon}>
              <Check size={32} color={Colors.verified} strokeWidth={2.5} />
            </View>
            <Text style={styles.packSuccessTitle}>Rail Pack Generated</Text>
            <Text style={styles.packSuccessSubtitle}>
              Use these templates and checklists to get your money back.
            </Text>
          </View>

          <View style={styles.templateCard}>
            <View style={styles.templateHeader}>
              <Text style={styles.templateLabel}>Refund Request Template</Text>
              <Pressable
                onPress={() => handleCopy(railPack.refund_request_template, "refund")}
                style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
              >
                {copiedField === "refund" ? (
                  <Check size={14} color={Colors.verified} strokeWidth={2.5} />
                ) : (
                  <Copy size={14} color={Colors.primary} strokeWidth={2} />
                )}
                <Text style={[styles.copyBtnText, copiedField === "refund" && { color: Colors.verified }]}>
                  {copiedField === "refund" ? "Copied" : "Copy"}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.templateText} selectable>{railPack.refund_request_template}</Text>
          </View>

          <View style={styles.templateCard}>
            <View style={styles.templateHeader}>
              <Text style={styles.templateLabel}>Follow-up Template</Text>
              <Pressable
                onPress={() => handleCopy(railPack.follow_up_template, "followup")}
                style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
              >
                {copiedField === "followup" ? (
                  <Check size={14} color={Colors.verified} strokeWidth={2.5} />
                ) : (
                  <Copy size={14} color={Colors.primary} strokeWidth={2} />
                )}
                <Text style={[styles.copyBtnText, copiedField === "followup" && { color: Colors.verified }]}>
                  {copiedField === "followup" ? "Copied" : "Copy"}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.templateText} selectable>{railPack.follow_up_template}</Text>
          </View>

          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Escalation Checklist</Text>
            {railPack.escalation_checklist.map((item, idx) => (
              <Text key={idx} style={styles.checklistItem}>{item}</Text>
            ))}
          </View>

          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Evidence Checklist</Text>
            {railPack.evidence_checklist.map((item, idx) => (
              <Text key={idx} style={styles.checklistItem}>{item}</Text>
            ))}
          </View>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>Disclaimer</Text>
            <Text style={styles.disclaimerText}>{railPack.disclaimer}</Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
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
          <Text style={styles.headerTitle}>Money Case</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <View style={styles.progressRow}>
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
        ))}
      </View>

      <View style={styles.wizardContainer}>
        {renderStep()}
      </View>

      {createCaseMutation.isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Failed to create case. Please try again.</Text>
        </View>
      )}

      <View style={styles.wizardFooter}>
        {step > 0 && (
          <Pressable
            onPress={() => setStep((p) => p - 1)}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <ChevronLeft size={20} color={Colors.text} strokeWidth={2} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {step < 5 ? (
          <Pressable
            onPress={() => canProceed && setStep((p) => p + 1)}
            disabled={!canProceed}
            style={({ pressed }) => [
              styles.nextBtn,
              !canProceed && styles.nextBtnDisabled,
              pressed && canProceed && styles.nextBtnPressed,
            ]}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <ChevronRight size={20} color="white" strokeWidth={2} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!canProceed || createCaseMutation.isPending}
            style={({ pressed }) => [
              styles.generateBtn,
              (!canProceed || createCaseMutation.isPending) && styles.nextBtnDisabled,
              pressed && canProceed && styles.generateBtnPressed,
            ]}
          >
            {createCaseMutation.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <FileText size={18} color="white" strokeWidth={2} />
                <Text style={styles.generateBtnText}>Generate Rail Pack</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
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
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.backgroundTertiary,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  wizardContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionsScroll: {
    flex: 1,
  },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  optionBtnSelected: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  optionBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  optionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  optionTextSelected: {
    color: Colors.text,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top" as const,
  },
  errorBanner: {
    backgroundColor: Colors.highRiskBg,
    borderTopWidth: 1,
    borderTopColor: Colors.highRisk,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontSize: 13,
    color: Colors.highRisk,
    textAlign: "center" as const,
  },
  wizardFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backBtnText: {
    fontSize: 15,
    color: Colors.text,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  nextBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "white",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.verified,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  generateBtnPressed: {
    backgroundColor: Colors.verifiedLight,
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "white",
  },
  packContent: {
    padding: 20,
    paddingBottom: 40,
  },
  packSuccessCard: {
    alignItems: "center",
    marginBottom: 24,
  },
  packSuccessIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${Colors.verified}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  packSuccessTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  packSuccessSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  templateCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
    marginBottom: 16,
  },
  templateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundTertiary,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  templateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    padding: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  checklistCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginBottom: 16,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 10,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  checklistItem: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 22,
  },
  disclaimerBox: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  disclaimerTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textTertiary,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  doneBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  doneBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700" as const,
  },
});
