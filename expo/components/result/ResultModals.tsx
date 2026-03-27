import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
} from "react-native";
import {
  X,
  Globe,
  Fingerprint,
  Users,
  Info,
  ExternalLink,
  Link2,
  ShieldCheck,
} from "lucide-react-native";
import BadgePill from "@/components/ui/BadgePill";
import Colors from "@/constants/colors";
import { styles } from "./resultStyles";
import type { ReportType } from "@/types/scan";

interface DisclaimerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DisclaimerModal({ visible, onClose }: DisclaimerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Verification Disclaimer</Text>
            <Pressable onPress={onClose} style={styles.modalCloseIcon}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.modalBullets}>
            <View style={styles.modalBulletRow}>
              <Globe size={16} color={Colors.accent} strokeWidth={2} />
              <Text style={styles.modalBulletText}>
                REAiL analyzes public signals and patterns—it does not access private data.
              </Text>
            </View>
            <View style={styles.modalBulletRow}>
              <Fingerprint size={16} color={Colors.accent} strokeWidth={2} />
              <Text style={styles.modalBulletText}>
                Results are probabilistic, not definitive proof of authenticity or fraud.
              </Text>
            </View>
            <View style={styles.modalBulletRow}>
              <Users size={16} color={Colors.accent} strokeWidth={2} />
              <Text style={styles.modalBulletText}>
                Always cross-check with other sources and use your own judgment.
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]}
            onPress={onClose}
          >
            <Text style={styles.modalCloseText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ScoreTooltipModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ScoreTooltipModal({ visible, onClose }: ScoreTooltipModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.tooltipCard} onPress={() => {}}>
          <View style={styles.tooltipHeader}>
            <Info size={18} color={Colors.accent} strokeWidth={2} />
            <Text style={styles.tooltipTitle}>Score ≠ Truth</Text>
          </View>
          <Text style={styles.tooltipText}>
            The risk score reflects detected patterns and signals. A high score means fewer risk signals were found—not that the content is true or safe. Always use context and judgment.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.tooltipBtn, pressed && styles.tooltipBtnPressed]}
            onPress={onClose}
          >
            <Text style={styles.tooltipBtnText}>Understood</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface SafeViewModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domain: string;
  badge: string;
  score: number;
}

export function SafeViewModal({ visible, onClose, onConfirm, domain, badge, score }: SafeViewModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Safe View Warning</Text>
            <Pressable onPress={onClose} style={styles.modalCloseIcon}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.safeViewContent}>
            <View style={styles.safeViewDomainRow}>
              <Link2 size={18} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.safeViewDomain} numberOfLines={1}>{domain}</Text>
            </View>
            <View style={styles.safeViewBadgeRow}>
              <BadgePill badge={badge as "VERIFIED" | "UNVERIFIED" | "HIGH_RISK"} size="small" />
              <Text style={styles.safeViewScore}>Risk Score: {score}/100</Text>
            </View>
            <Text style={styles.safeViewWarning}>
              You are about to open this link in your browser. REAiL cannot guarantee the safety of external content.
            </Text>
          </View>
          <View style={styles.safeViewActions}>
            <Pressable
              style={({ pressed }) => [styles.safeViewCancelBtn, pressed && styles.safeViewCancelBtnPressed]}
              onPress={onClose}
            >
              <Text style={styles.safeViewCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.safeViewConfirmBtn, pressed && styles.safeViewConfirmBtnPressed]}
              onPress={onConfirm}
            >
              <ExternalLink size={16} color="white" strokeWidth={2} />
              <Text style={styles.safeViewConfirmText}>Continue</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  domain: string;
  reportType: ReportType;
  setReportType: (rt: ReportType) => void;
  reportDescription: string;
  setReportDescription: (text: string) => void;
  reportSubmitting: boolean;
  reportSuccess: boolean;
  onSubmit: () => void;
}

export function ReportModal({
  visible,
  onClose,
  domain,
  reportType,
  setReportType,
  reportDescription,
  setReportDescription,
  reportSubmitting,
  reportSuccess,
  onSubmit,
}: ReportModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {reportSuccess ? (
            <View style={styles.reportSuccessContent}>
              <View style={styles.reportSuccessIcon}>
                <ShieldCheck size={32} color={Colors.verified} strokeWidth={2} />
              </View>
              <Text style={styles.reportSuccessTitle}>Report Submitted</Text>
              <Text style={styles.reportSuccessText}>Thank you for helping keep the community safe.</Text>
            </View>
          ) : (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report URL</Text>
                <Pressable onPress={onClose} style={styles.modalCloseIcon}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={2} />
                </Pressable>
              </View>
              <Text style={styles.reportDomainLabel}>{domain}</Text>
              <Text style={styles.reportTypeLabel}>Report type</Text>
              <View style={styles.reportTypeRow}>
                {(["scam", "phishing", "spam", "misleading", "safe"] as ReportType[]).map((rt) => (
                  <Pressable
                    key={rt}
                    onPress={() => setReportType(rt)}
                    style={[
                      styles.reportTypeChip,
                      reportType === rt && styles.reportTypeChipActive,
                    ]}
                  >
                    <Text style={[
                      styles.reportTypeText,
                      reportType === rt && styles.reportTypeTextActive,
                    ]}>
                      {rt.charAt(0).toUpperCase() + rt.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Optional: Describe what you found..."
                placeholderTextColor={Colors.textTertiary}
                style={styles.reportInput}
                multiline
                numberOfLines={3}
              />
              <Pressable
                onPress={onSubmit}
                disabled={reportSubmitting}
                style={({ pressed }) => [
                  styles.reportSubmitBtn,
                  pressed && styles.reportSubmitBtnPressed,
                  reportSubmitting && styles.reportSubmitBtnDisabled,
                ]}
              >
                <Text style={styles.reportSubmitText}>
                  {reportSubmitting ? "Submitting..." : "Submit Report"}
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
