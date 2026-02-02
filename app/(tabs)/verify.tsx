import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  Modal, 
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  BadgeCheck, 
  Building2, 
  User, 
  ArrowRight, 
  X,
  Shield,
  CheckCircle,
  Star,
  TrendingUp,
  Info,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/Logo';

const WAITLIST_KEY = 'reail_waitlist_emails';

export default function VerifyScreen() {
  const { t } = useApp();
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [whatIsModalOpen, setWhatIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onJoinWaitlist = async (type: 'business' | 'creator') => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const existing = await AsyncStorage.getItem(WAITLIST_KEY);
      const list = existing ? JSON.parse(existing) : [];
      const entry = { email: trimmed, type, timestamp: Date.now() };
      list.push(entry);
      await AsyncStorage.setItem(WAITLIST_KEY, JSON.stringify(list));
      
      setEmail('');
      setBusinessModalOpen(false);
      setCreatorModalOpen(false);
      
      if (Platform.OS === 'web') {
        alert('You have been added to the waitlist!');
      } else {
        Alert.alert('Success', 'You have been added to the waitlist! We will contact you soon.');
      }
    } catch {
      Alert.alert('Error', 'Failed to join waitlist. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const businessBenefits = [
    'Display verified badge on all your links',
    'Priority support and faster scans',
    'Analytics dashboard for your domain',
  ];

  const creatorBenefits = [
    'Stand out with creator verification badge',
    'Protect your audience from impersonators',
    'Build trust with your followers',
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
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

            <Pressable 
              onPress={() => setWhatIsModalOpen(true)}
              style={({ pressed }) => [styles.whatIsBtn, pressed && styles.whatIsBtnPressed]}
            >
              <Info size={16} color={Colors.accent} strokeWidth={2} />
              <Text style={styles.whatIsText}>What does verification mean?</Text>
            </Pressable>

            <View style={styles.cardsContainer}>
              <Pressable 
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} 
                onPress={() => setBusinessModalOpen(true)}
              >
                <View style={styles.cardIcon}>
                  <Building2 size={24} color={Colors.verified} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Verified Business</Text>
                  <Text style={styles.cardDescription}>Build trust with your customers</Text>
                </View>
                <ArrowRight size={20} color={Colors.textTertiary} />
              </Pressable>

              <Pressable 
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} 
                onPress={() => setCreatorModalOpen(true)}
              >
                <View style={styles.cardIcon}>
                  <User size={24} color={Colors.accent} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Verified Creator</Text>
                  <Text style={styles.cardDescription}>Stand out as authentic</Text>
                </View>
                <ArrowRight size={20} color={Colors.textTertiary} />
              </Pressable>
            </View>

            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>{t.comingSoon}</Text>
            </View>

            <Text style={styles.description}>
              Get your business or creator profile verified by REAiL to build trust with your audience. Verified accounts receive a special badge that appears in scan results.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={businessModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBusinessModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setBusinessModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBadge}>
                <Building2 size={24} color={Colors.verified} />
              </View>
              <Text style={styles.modalTitle}>Verified Business</Text>
              <Pressable onPress={() => setBusinessModalOpen(false)} style={styles.modalCloseIcon}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>Benefits include:</Text>
            <View style={styles.benefitsList}>
              {businessBenefits.map((benefit, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <CheckCircle size={16} color={Colors.verified} strokeWidth={2} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.inputLabel}>Join the waitlist</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable 
              style={({ pressed }) => [
                styles.joinBtn, 
                pressed && styles.joinBtnPressed,
                submitting && styles.joinBtnDisabled
              ]} 
              onPress={() => onJoinWaitlist('business')}
              disabled={submitting}
            >
              <Text style={styles.joinBtnText}>
                {submitting ? 'Joining...' : 'Join Waitlist'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={creatorModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatorModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreatorModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBadge, { backgroundColor: `${Colors.accent}20` }]}>
                <User size={24} color={Colors.accent} />
              </View>
              <Text style={styles.modalTitle}>Verified Creator</Text>
              <Pressable onPress={() => setCreatorModalOpen(false)} style={styles.modalCloseIcon}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>Benefits include:</Text>
            <View style={styles.benefitsList}>
              {creatorBenefits.map((benefit, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Star size={16} color={Colors.accent} strokeWidth={2} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.inputLabel}>Join the waitlist</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable 
              style={({ pressed }) => [
                styles.joinBtn, 
                styles.joinBtnCreator,
                pressed && styles.joinBtnCreatorPressed,
                submitting && styles.joinBtnDisabled
              ]} 
              onPress={() => onJoinWaitlist('creator')}
              disabled={submitting}
            >
              <Text style={styles.joinBtnText}>
                {submitting ? 'Joining...' : 'Join Waitlist'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={whatIsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWhatIsModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setWhatIsModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBadge, { backgroundColor: `${Colors.accent}20` }]}>
                <Shield size={24} color={Colors.accent} />
              </View>
              <Text style={styles.modalTitle}>What Verification Means</Text>
              <Pressable onPress={() => setWhatIsModalOpen(false)} style={styles.modalCloseIcon}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.whatIsContent}>
              <View style={styles.whatIsRow}>
                <CheckCircle size={18} color={Colors.verified} strokeWidth={2} />
                <View style={styles.whatIsTextWrap}>
                  <Text style={styles.whatIsLabel}>Identity Verified</Text>
                  <Text style={styles.whatIsDesc}>
                    We verify that you are who you claim to be through documentation and business records.
                  </Text>
                </View>
              </View>

              <View style={styles.whatIsRow}>
                <Shield size={18} color={Colors.verified} strokeWidth={2} />
                <View style={styles.whatIsTextWrap}>
                  <Text style={styles.whatIsLabel}>Trust Badge</Text>
                  <Text style={styles.whatIsDesc}>
                    Your links display a verified badge in scan results, building trust with your audience.
                  </Text>
                </View>
              </View>

              <View style={styles.whatIsRow}>
                <TrendingUp size={18} color={Colors.verified} strokeWidth={2} />
                <View style={styles.whatIsTextWrap}>
                  <Text style={styles.whatIsLabel}>Higher Trust Score</Text>
                  <Text style={styles.whatIsDesc}>
                    Verified accounts receive a trust score boost in our verification engine.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.whatIsDisclaimer}>
              <Text style={styles.whatIsDisclaimerText}>
                Verification does not guarantee behavior or content quality. It confirms identity only.
              </Text>
            </View>

            <Pressable 
              style={({ pressed }) => [styles.gotItBtn, pressed && styles.gotItBtnPressed]} 
              onPress={() => setWhatIsModalOpen(false)}
            >
              <Text style={styles.gotItBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    fontSize: 24,
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
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  whatIsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  whatIsBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  whatIsText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600' as const,
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
  cardPressed: {
    backgroundColor: Colors.backgroundTertiary,
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
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${Colors.verified}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  modalCloseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  benefitsList: {
    gap: 10,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  inputLabel: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalInput: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: Colors.text,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  joinBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.verified,
  },
  joinBtnPressed: {
    backgroundColor: Colors.verifiedLight,
  },
  joinBtnCreator: {
    backgroundColor: Colors.accent,
  },
  joinBtnCreatorPressed: {
    backgroundColor: Colors.accentLight,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  whatIsContent: {
    gap: 16,
    marginBottom: 16,
  },
  whatIsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  whatIsTextWrap: {
    flex: 1,
  },
  whatIsLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  whatIsDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  whatIsDisclaimer: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  whatIsDisclaimerText: {
    color: Colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  gotItBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  gotItBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  gotItBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
