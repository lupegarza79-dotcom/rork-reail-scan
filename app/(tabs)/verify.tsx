import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeCheck, Building2, User, ArrowRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/Logo';

export default function VerifyScreen() {
  const { t } = useApp();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.verify}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.logoSection}>
            <View style={styles.iconBadge}>
              <BadgeCheck size={48} color={Colors.accent} />
            </View>
            <Logo size="large" showSubtext />
          </View>

          <Text style={styles.title}>{t.getVerified}</Text>
          <Text style={styles.subtitle}>{t.verifySubtitle}</Text>

          <View style={styles.cardsContainer}>
            <TouchableOpacity style={styles.card} activeOpacity={0.7}>
              <View style={styles.cardIcon}>
                <Building2 size={24} color={Colors.verified} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Verified Business</Text>
                <Text style={styles.cardDescription}>Build trust with your customers</Text>
              </View>
              <ArrowRight size={20} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.card} activeOpacity={0.7}>
              <View style={styles.cardIcon}>
                <User size={24} color={Colors.accent} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Verified Creator</Text>
                <Text style={styles.cardDescription}>Stand out as authentic</Text>
              </View>
              <ArrowRight size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>{t.comingSoon}</Text>
          </View>

          <Text style={styles.description}>
            Get your business or creator profile verified by REAiL to build trust with your audience. Verified accounts receive a special badge that appears in scan results.
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  iconBadge: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  cardsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  comingSoonBadge: {
    backgroundColor: Colors.accentSecondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
});
