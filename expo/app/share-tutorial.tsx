import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share, CheckCircle, Smartphone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/Logo';

export default function ShareTutorialScreen() {
  const router = useRouter();
  const { t } = useApp();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleEnable = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [router]);

  const handleNotNow = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Logo size="medium" showSubtext />

          <Text style={styles.title}>{t.shareTutorialTitle}</Text>
          <Text style={styles.subtitle}>Works with links and screenshots</Text>

          <View style={styles.stepsContainer}>
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepIconContainer}>
                  <Share size={32} color={Colors.primary} />
                </View>
                <Text style={styles.stepTitle}>{t.shareTutorialStep1}</Text>
                <Text style={styles.stepDescription}>
                  When you see suspicious content, tap the share button
                </Text>
              </View>
            </View>

            <View style={styles.connector}>
              <View style={styles.connectorLine} />
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepIconContainer}>
                  <Smartphone size={32} color={Colors.accent} />
                </View>
                <Text style={styles.stepTitle}>{t.shareTutorialStep2}</Text>
                <Text style={styles.stepDescription}>
                  Select REAiL Scan from your share sheet to analyze instantly
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.benefitsContainer}>
            <View style={styles.benefitRow}>
              <CheckCircle size={18} color={Colors.verified} />
              <Text style={styles.benefitText}>Scan any link in 2 taps</Text>
            </View>
            <View style={styles.benefitRow}>
              <CheckCircle size={18} color={Colors.verified} />
              <Text style={styles.benefitText}>No copy-paste needed</Text>
            </View>
            <View style={styles.benefitRow}>
              <CheckCircle size={18} color={Colors.verified} />
              <Text style={styles.benefitText}>Works with all apps</Text>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.enableButton} onPress={handleEnable} activeOpacity={0.85}>
              <CheckCircle size={20} color={Colors.text} />
              <Text style={styles.enableButtonText}>{t.enableShareScan}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.notNowButton} onPress={handleNotNow}>
              <Text style={styles.notNowText}>{t.notNow}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 40,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
  },
  stepIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  connector: {
    alignItems: 'center',
    height: 24,
  },
  connectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: Colors.border,
  },
  benefitsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  notNowButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  notNowText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
