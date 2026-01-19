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
} from 'react-native';
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import Badge from '@/components/Badge';
import Logo from '@/components/Logo';

const REASON_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export default function ResultScreen() {
  const router = useRouter();
  const { t, currentScan } = useApp();
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [displayScore, setDisplayScore] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (currentScan) {
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

      const duration = 1500;
      const startTime = Date.now();
      const targetScore = currentScan.score;
      
      const animateScore = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * targetScore);
        setDisplayScore(current);
        
        if (progress < 1) {
          requestAnimationFrame(animateScore);
        }
      };
      
      requestAnimationFrame(animateScore);
    }
  }, [currentScan, fadeAnim, slideAnim]);

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
    Alert.alert('Report Submitted', 'Thank you for helping keep the internet safe.');
  }, []);

  const handleShareImage = useCallback(() => {
    Alert.alert('Share as Image', 'Image sharing will be available soon.');
  }, []);

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

          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
              <Bookmark size={20} color={Colors.text} />
              <Text style={styles.actionText}>{t.save}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.primaryAction]} onPress={handleShare}>
              <Share2 size={20} color={Colors.text} />
              <Text style={styles.actionText}>{t.shareReport}</Text>
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
            
            <TouchableOpacity style={styles.shareImageButton} onPress={handleShareImage}>
              <Image size={18} color={Colors.primary} />
              <Text style={styles.shareImageText}>{t.shareAsImage}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
