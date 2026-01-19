import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Share2, 
  Bookmark, 
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Image,
  X,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import Badge from '@/components/Badge';
import Logo from '@/components/Logo';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const REASON_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const SCORE_ANIMATION_DURATION = 800;

const REPORT_CATEGORIES = [
  { key: 'scam_sale', label: 'Scam sale' },
  { key: 'fake_identity', label: 'Fake identity' },
  { key: 'manipulated_media', label: 'Manipulated media' },
  { key: 'misleading_claims', label: 'Misleading claims' },
  { key: 'other', label: 'Other' },
];

export default function ResultScreen() {
  const router = useRouter();
  const { t, currentScan, canReport, recordReport } = useApp();
  const reduceMotion = useReduceMotion();
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [displayScore, setDisplayScore] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    if (currentScan) {
      if (reduceMotion) {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
        setDisplayScore(currentScan.score);
        return;
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();

      const startTime = Date.now();
      const targetScore = currentScan.score;
      
      const animateScore = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / SCORE_ANIMATION_DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * targetScore);
        setDisplayScore(current);
        
        if (progress < 1) {
          requestAnimationFrame(animateScore);
        }
      };
      
      requestAnimationFrame(animateScore);
    }
  }, [currentScan, fadeAnim, slideAnim, reduceMotion]);

  const toggleReason = useCallback((key: string) => {
    setExpandedReasons(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleShare = useCallback(async () => {
    if (!currentScan) return;
    try {
      const badgeText = currentScan.badge === 'VERIFIED' ? '✅' : currentScan.badge === 'UNVERIFIED' ? '⚠️' : '❌';
      const message = `${badgeText} REAiL Scan Result\n\nDomain: ${currentScan.domain}\nTrust Score: ${currentScan.score}/100\nStatus: ${currentScan.badge}\n\n${t.verifiedBy}\n\nScan any link at reail.app`;
      await Share.share({ message });
    } catch (error) {
      console.log('Share error:', error);
    }
  }, [currentScan, t]);

  const handleSave = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert('Saved', 'Scan saved to your history.');
  }, []);

  const handleReport = useCallback(() => {
    if (!canReport()) {
      Alert.alert('Rate Limit', 'You have reached the maximum number of reports for today. Please try again tomorrow.');
      return;
    }
    setShowReportModal(true);
  }, [canReport]);

  const submitReport = useCallback((category: string) => {
    recordReport();
    setShowReportModal(false);
    setSelectedCategory(null);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert('Report Submitted', `Thank you for reporting this as "${category}". This helps keep the internet safe.`);
  }, [recordReport]);

  const handleShareImage = useCallback(async () => {
    if (!currentScan || !shareCardRef.current) return;
    
    if (Platform.OS === 'web') {
      Alert.alert('Share as Image', 'Image sharing is not available on web. Use the Share Report button instead.');
      return;
    }

    try {
      setIsCapturing(true);
      
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share REAiL Scan Result',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.log('Share image error:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [currentScan]);

  if (!currentScan) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No scan result available</Text>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const getVerdict = () => {
    switch (currentScan.badge) {
      case 'VERIFIED':
        return t.verdictVerified;
      case 'UNVERIFIED':
        return t.verdictUnverified;
      case 'HIGH_RISK':
        return t.verdictHighRisk;
    }
  };

  const getScoreColor = () => {
    if (currentScan.score >= 80) return Colors.verified;
    if (currentScan.score >= 50) return Colors.unverified;
    return Colors.highRisk;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.result}</Text>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Share2 size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.badgeSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <Badge type={currentScan.badge} size="large" />
            
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>{t.trustScore}</Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreValue, { color: getScoreColor() }]}>
                  {displayScore}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <View style={[styles.scoreBar, { backgroundColor: Colors.backgroundTertiary }]}>
                <Animated.View 
                  style={[
                    styles.scoreBarFill,
                    { 
                      backgroundColor: getScoreColor(),
                      width: `${displayScore}%`,
                    }
                  ]} 
                />
              </View>
            </View>

            <Text style={styles.domain}>{currentScan.domain}</Text>
            <Text style={styles.verdict}>{getVerdict()}</Text>
          </Animated.View>

          <View style={styles.reasonsSection}>
            <Text style={styles.sectionTitle}>{t.whyTitle}</Text>
            
            {REASON_KEYS.map((key) => {
              const reason = currentScan.reasons[key];
              const isExpanded = expandedReasons.has(key);
              
              return (
                <TouchableOpacity 
                  key={key}
                  style={styles.reasonCard}
                  onPress={() => toggleReason(key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.reasonHeader}>
                    <View style={styles.reasonKeyBadge}>
                      <Text style={styles.reasonKey}>{key}</Text>
                    </View>
                    <View style={styles.reasonContent}>
                      <Text style={styles.reasonTitle}>{reason.title}</Text>
                      <Text style={styles.reasonSummary}>{reason.summary}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={Colors.textTertiary} />
                    ) : (
                      <ChevronDown size={20} color={Colors.textTertiary} />
                    )}
                  </View>
                  
                  {isExpanded && (
                    <View style={styles.reasonDetails}>
                      {reason.details.map((detail, index) => (
                        <View key={index} style={styles.detailRow}>
                          <View style={styles.detailBullet} />
                          <Text style={styles.detailText}>{detail}</Text>
                        </View>
                      ))}
                      {reason.suggestion && (
                        <View style={styles.suggestionBox}>
                          <Text style={styles.suggestionLabel}>{t.whatWouldVerify}</Text>
                          <Text style={styles.suggestionText}>{reason.suggestion}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryActionButton} onPress={handleShare}>
              <Share2 size={20} color={Colors.text} />
              <Text style={styles.primaryActionText}>{t.shareReport}</Text>
            </TouchableOpacity>

          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
              <Bookmark size={20} color={Colors.text} />
              <Text style={styles.actionText}>{t.save}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.dangerAction]} onPress={handleReport}>
              <AlertOctagon size={20} color={Colors.highRisk} />
              <Text style={[styles.actionText, styles.dangerText]}>{t.reportScam}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shareCardSection}>
            <View style={styles.shareCard}>
              <View style={styles.shareCardHeader}>
                <Logo size="small" />
                <Badge type={currentScan.badge} size="small" />
              </View>
              <Text style={styles.shareCardDomain}>{currentScan.domain}</Text>
              <Text style={styles.shareCardScore}>Score: {currentScan.score}/100</Text>
              <Text style={styles.shareCardFooter}>{t.verifiedBy}</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.shareImageButton, isCapturing && styles.shareImageButtonDisabled]} 
              onPress={handleShareImage}
              disabled={isCapturing}
            >
              <Image size={18} color={isCapturing ? Colors.textTertiary : Colors.primary} />
              <Text style={[styles.shareImageText, isCapturing && styles.shareImageTextDisabled]}>
                {isCapturing ? 'Capturing...' : t.shareAsImage}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.disclaimerSection}>
            <Text style={styles.disclaimerText}>{t.disclaimer}</Text>
          </View>
        </ScrollView>

        <Modal
          visible={showReportModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.reportScam}</Text>
                <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.modalClose}>
                  <X size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>{t.selectCategory}</Text>
              {REPORT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryOption,
                    selectedCategory === cat.key && styles.categoryOptionSelected,
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === cat.key && styles.categoryTextSelected,
                  ]}>
                    {cat.label}
                  </Text>
                  {selectedCategory === cat.key && (
                    <Check size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.submitReportButton,
                  !selectedCategory && styles.submitReportButtonDisabled,
                ]}
                onPress={() => selectedCategory && submitReport(selectedCategory)}
                disabled={!selectedCategory}
              >
                <Text style={styles.submitReportText}>{t.submitReport}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  badgeSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  scoreContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    width: '100%',
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '700' as const,
  },
  scoreMax: {
    fontSize: 22,
    color: Colors.textTertiary,
    marginLeft: 2,
  },
  scoreBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  domain: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  verdict: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  reasonsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  reasonCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  reasonKeyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reasonKey: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  reasonContent: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  reasonSummary: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reasonDetails: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  detailBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
    marginTop: 6,
    marginRight: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  suggestionBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 8,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  primaryAction: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dangerAction: {
    borderColor: Colors.highRisk,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  dangerText: {
    color: Colors.highRisk,
  },
  shareCardSection: {
    alignItems: 'center',
  },
  shareCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  shareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  shareCardDomain: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  shareCardScore: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  shareCardFooter: {
    fontSize: 11,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  shareImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  shareImageText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  shareImageButtonDisabled: {
    opacity: 0.6,
  },
  shareImageTextDisabled: {
    color: Colors.textTertiary,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  disclaimerSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalClose: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  categoryText: {
    fontSize: 14,
    color: Colors.text,
  },
  categoryTextSelected: {
    fontWeight: '600' as const,
  },
  submitReportButton: {
    backgroundColor: Colors.highRisk,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitReportButtonDisabled: {
    opacity: 0.5,
  },
  submitReportText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
