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
  FileCheck,
  Lock,
  Zap,
  AlertTriangle,
  Flag,
  UserCheck,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import Logo from '@/components/Logo';

const WAITLIST_KEY = 'reail_waitlist_emails';

export default function VerifyPlusScreen() {
  const router = useRouter();
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
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <BadgeCheck size={20} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.title}>Verify+</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.logoSection}>
            <View style={styles.iconBadge}>
              <Shield size={48} color={Colors.accent} strokeWidth={1.5} />
            </View>
            <Logo size="large" showSubtext />
          </View>

          <Text style={styles.heroTitle}>Verification is earned, not claimed</Text>
          <Text style={styles.subtitle}>
            Build trust through evidence, not just badges
          </Text>

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
              <View style={[styles.cardIcon, { backgroundColor: `${Colors.verified}15` }]}>
                <Building2 size={24} color={Colors.verified} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Verified Business</Text>
                <Text style={styles.cardDescription}>Prove legitimacy through documentation</Text>
              </View>
              <ArrowRight size={20} color={Colors.textTertiary} />
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} 
              onPress={() => setCreatorModalOpen(true)}
            >
              <View style={[styles.cardIcon, { backgroundColor: `${Colors.accent}15` }]}>
                <User size={24} color={Colors.accent} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Verified Creator</Text>
                <Text style={styles.cardDescription}>Establish authenticity for your audience</Text>
              </View>
              <ArrowRight size={20} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.evidenceBadge}>
            <FileCheck size={14} color={Colors.accent} strokeWidth={2} />
            <Text style={styles.evidenceBadgeText}>Verification requires evidence</Text>
          </View>

          <View style={styles.principlesSection}>
            <Text style={styles.principlesTitle}>Our Principles</Text>
            
            <View style={styles.principleRow}>
              <View style={styles.principleIcon}>
                <Lock size={16} color={Colors.verified} strokeWidth={2} />
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleLabel}>Evidence-Based</Text>
                <Text style={styles.principleDesc}>
                  Verification requires documentation, not just claims
                </Text>
              </View>
            </View>

            <View style={styles.principleRow}>
              <View style={styles.principleIcon}>
                <Shield size={16} color={Colors.verified} strokeWidth={2} />
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleLabel}>Trust, Not Endorsement</Text>
                <Text style={styles.principleDesc}>
                  Verified ≠ we endorse. It confirms identity only.
                </Text>
              </View>
            </View>

            <View style={styles.principleRow}>
              <View style={styles.principleIcon}>
                <Zap size={16} color={Colors.verified} strokeWidth={2} />
              </View>
              <View style={styles.principleContent}>
                <Text style={styles.principleLabel}>Continuous Monitoring</Text>
                <Text style={styles.principleDesc}>
                  Verification can be revoked if evidence changes
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.fairnessSection}>
            <Text style={styles.fairnessTitle}>Fairness & Accuracy</Text>
            <Text style={styles.fairnessSubtitle}>
              We believe in accountability. If something is wrong, tell us.
            </Text>

            <Pressable
              onPress={() => router.push('/claim' as any)}
              style={({ pressed }) => [styles.fairnessCard, pressed && styles.fairnessCardPressed]}
            >
              <View style={[styles.fairnessIcon, { backgroundColor: `${Colors.verified}15` }]}>
                <UserCheck size={18} color={Colors.verified} strokeWidth={2} />
              </View>
              <View style={styles.fairnessContent}>
                <Text style={styles.fairnessLabel}>Claim Profile</Text>
                <Text style={styles.fairnessDesc}>Prove you own this domain or brand</Text>
              </View>
              <ArrowRight size={16} color={Colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/appeal' as any)}
              style={({ pressed }) => [styles.fairnessCard, pressed && styles.fairnessCardPressed]}
            >
              <View style={[styles.fairnessIcon, { backgroundColor: `${Colors.unverified}15` }]}>
                <AlertTriangle size={18} color={Colors.unverified} strokeWidth={2} />
              </View>
              <View style={styles.fairnessContent}>
                <Text style={styles.fairnessLabel}>Submit Appeal</Text>
                <Text style={styles.fairnessDesc}>Challenge a scan result with evidence</Text>
              </View>
              <ArrowRight size={16} color={Colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/appeal' as any)}
              style={({ pressed }) => [styles.fairnessCard, pressed && styles.fairnessCardPressed]}
            >
              <View style={[styles.fairnessIcon, { backgroundColor: `${Colors.highRisk}15` }]}>
                <Flag size={18} color={Colors.highRisk} strokeWidth={2} />
              </View>
              <View style={styles.fairnessContent}>
                <Text style={styles.fairnessLabel}>Report Mistake</Text>
                <Text style={styles.fairnessDesc}>Flag an incorrect or unfair result</Text>
              </View>
              <ArrowRight size={16} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <Text style={styles.footerText}>
            Get verified to build trust with your audience. Verified accounts receive a special badge in scan results—but verification is earned through evidence, not purchased.
          </Text>
        </View>
      </ScrollView>

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

            <View style={styles.requirementBox}>
              <Text style={styles.requirementTitle}>Requirements</Text>
              <Text style={styles.requirementText}>
                • Business registration documents{"\n"}
                • Domain ownership verification{"\n"}
                • Contact information validation
              </Text>
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

            <View style={styles.requirementBox}>
              <Text style={styles.requirementTitle}>Requirements</Text>
              <Text style={styles.requirementText}>
                • Verified social media presence{"\n"}
                • Consistent content history{"\n"}
                • Identity verification
              </Text>
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
                    We verify that you are who you claim to be through documentation and records.
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
                  <Text style={styles.whatIsLabel}>Higher Risk Score</Text>
                  <Text style={styles.whatIsDesc}>
                    Verified accounts receive a score boost in our verification engine.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.whatIsDisclaimer}>
              <Text style={styles.whatIsDisclaimerTitle}>Important</Text>
              <Text style={styles.whatIsDisclaimerText}>
                Verification confirms identity only. It does not guarantee behavior, content quality, or endorsement by REAiL. Lack of verification ≠ scam.
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
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  iconBadge: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 30,
    backgroundColor: `${Colors.accent}15`,
    borderWidth: 1,
    borderColor: `${Colors.accent}30`,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
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
    marginBottom: 20,
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
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.accent}15`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  evidenceBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  principlesSection: {
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  principlesTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  principleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${Colors.verified}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principleContent: {
    flex: 1,
  },
  principleLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  principleDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  fairnessSection: {
    width: '100%',
    marginBottom: 24,
  },
  fairnessTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  fairnessSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  fairnessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 10,
  },
  fairnessCardPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  fairnessIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fairnessContent: {
    flex: 1,
  },
  fairnessLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  fairnessDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
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
    marginBottom: 16,
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
  requirementBox: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  requirementTitle: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  requirementText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 20,
  },
  inputLabel: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${Colors.unverified}30`,
  },
  whatIsDisclaimerTitle: {
    color: Colors.unverified,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  whatIsDisclaimerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
