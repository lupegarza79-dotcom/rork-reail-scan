import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Share, ActivityIndicator, Linking, ScrollView, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle, Share2, ArrowRight, ExternalLink, RefreshCw, DollarSign, X, ChevronRight, ChevronLeft, FileText } from 'lucide-react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Logo from '@/components/Logo';
import { resolveShareLink, WalletShareData } from '@/utils/walletShare';
import { createMoneyCase } from '@/utils/api';
import type { BadgeType, MoneyCaseIssue, PaymentMethodType, DesiredOutcome } from '@/types/scan';

const BADGE_CONFIG: Record<BadgeType | 'UNKNOWN', { 
  color: string; 
  bg: string; 
  labelEn: string;
  labelEs: string;
  Icon: typeof Shield;
}> = {
  VERIFIED: {
    color: Colors.verified,
    bg: Colors.verifiedBg,
    labelEn: 'Verified Safe',
    labelEs: 'Verificado',
    Icon: ShieldCheck,
  },
  UNVERIFIED: {
    color: Colors.unverified,
    bg: Colors.unverifiedBg,
    labelEn: 'Unverified',
    labelEs: 'No verificado',
    Icon: ShieldQuestion,
  },
  HIGH_RISK: {
    color: Colors.highRisk,
    bg: Colors.highRiskBg,
    labelEn: 'High Risk',
    labelEs: 'Alto riesgo',
    Icon: ShieldAlert,
  },
  UNKNOWN: {
    color: Colors.textSecondary,
    bg: Colors.backgroundTertiary,
    labelEn: 'Not Scanned',
    labelEs: 'Sin escanear',
    Icon: Shield,
  },
};

const ISSUE_OPTIONS: { value: MoneyCaseIssue; labelEn: string; labelEs: string }[] = [
  { value: 'unauthorized_charge', labelEn: 'Unauthorized Charge', labelEs: 'Cargo no autorizado' },
  { value: 'product_not_received', labelEn: 'Product Not Received', labelEs: 'Producto no recibido' },
  { value: 'product_not_as_described', labelEn: 'Not as Described', labelEs: 'Diferente al descrito' },
  { value: 'duplicate_charge', labelEn: 'Duplicate Charge', labelEs: 'Cargo duplicado' },
  { value: 'subscription_cancellation', labelEn: 'Subscription Issue', labelEs: 'Problema de suscripción' },
  { value: 'refund_not_processed', labelEn: 'Refund Not Processed', labelEs: 'Reembolso no procesado' },
  { value: 'scam_fraud', labelEn: 'Scam / Fraud', labelEs: 'Estafa / Fraude' },
  { value: 'other', labelEn: 'Other', labelEs: 'Otro' },
];

const PAYMENT_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash_app', label: 'Cash App' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'google_pay', label: 'Google Pay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'other', label: 'Other' },
];

const OUTCOME_OPTIONS: { value: DesiredOutcome; labelEn: string; labelEs: string }[] = [
  { value: 'full_refund', labelEn: 'Full Refund', labelEs: 'Reembolso completo' },
  { value: 'partial_refund', labelEn: 'Partial Refund', labelEs: 'Reembolso parcial' },
  { value: 'replacement', labelEn: 'Replacement', labelEs: 'Reemplazo' },
  { value: 'store_credit', labelEn: 'Store Credit', labelEs: 'Crédito en tienda' },
  { value: 'chargeback', labelEn: 'Chargeback', labelEs: 'Contracargo' },
  { value: 'other', labelEn: 'Other', labelEs: 'Otra resolución' },
];

interface WizardData {
  issueType: MoneyCaseIssue | null;
  amount: string;
  transactionDate: string;
  paymentMethod: PaymentMethodType | null;
  merchantName: string;
  description: string;
  desiredOutcome: DesiredOutcome | null;
  locale: 'en' | 'es';
}

function detectLocale(): 'en' | 'es' {
  if (Platform.OS === 'web') {
    try {
      const lang = navigator.language || '';
      if (lang.startsWith('es')) return 'es';
    } catch { /* ignore */ }
  }
  return 'en';
}

export default function ShareLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [uiLocale, setUiLocale] = useState<'en' | 'es'>(detectLocale);
  
  const [wizardData, setWizardData] = useState<WizardData>({
    issueType: null,
    amount: '',
    transactionDate: '',
    paymentMethod: null,
    merchantName: '',
    description: '',
    desiredOutcome: null,
    locale: detectLocale(),
  });

  const { data, isLoading, error, refetch } = useQuery<WalletShareData | null>({
    queryKey: ['share-link', token],
    queryFn: () => resolveShareLink(token || ''),
    enabled: !!token,
    staleTime: 30000,
  });

  const createCaseMutation = useMutation({
    mutationFn: createMoneyCase,
    onSuccess: (response) => {
      if (response?.case_id) {
        setShowWizard(false);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        console.log('[ShareLink] Case created, navigating to refund:', response.case_id);
        router.push({
          pathname: '/s/[token]/refund',
          params: { token: token || '', caseId: response.case_id, locale: wizardData.locale },
        } as any);
      }
    },
  });

  const badgeKey = useMemo(() => {
    if (!data?.badge) return 'UNKNOWN';
    return data.badge as BadgeType;
  }, [data?.badge]);

  const config = BADGE_CONFIG[badgeKey] || BADGE_CONFIG.UNKNOWN;
  const BadgeIcon = config.Icon;
  const isEs = uiLocale === 'es';

  const handleShare = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const shareUrl = Platform.OS === 'web' 
      ? window.location.href 
      : `https://reail.app/s/${token}`;
    
    const message = data?.badge === 'HIGH_RISK'
      ? (isEs
        ? `Advertencia: Este enlace fue marcado como ALTO RIESGO por REAiL Scan. Revisa el reporte: ${shareUrl}`
        : `Warning! This link has been flagged as HIGH RISK by REAiL Scan. Check the report: ${shareUrl}`)
      : data?.badge === 'VERIFIED'
      ? (isEs
        ? `Este enlace fue verificado como seguro por REAiL Scan: ${shareUrl}`
        : `This link has been verified as safe by REAiL Scan: ${shareUrl}`)
      : (isEs
        ? `Revisa el reporte de seguridad de este enlace en REAiL Scan: ${shareUrl}`
        : `Check this link's safety report on REAiL Scan: ${shareUrl}`);

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: 'REAiL Safety Report', text: message, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
        }
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      console.log('[ShareLink] Share error:', err);
    }
  }, [token, data, isEs]);

  const handleOpenLink = useCallback(() => {
    if (data?.original_url) {
      Linking.openURL(data.original_url);
    }
  }, [data?.original_url]);

  const handleStartWizard = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setWizardData(prev => ({
      ...prev,
      merchantName: data?.domain || '',
      locale: uiLocale,
    }));
    setShowWizard(true);
    setWizardStep(0);
  }, [data?.domain, uiLocale]);

  const { mutate: submitCase } = createCaseMutation;
  
  const handleSubmitCase = useCallback(() => {
    if (!wizardData.issueType) return;
    
    const amountCents = wizardData.amount ? Math.round(parseFloat(wizardData.amount.replace(/[^0-9.]/g, '')) * 100) : undefined;
    
    submitCase({
      share_token: token,
      issue_type: wizardData.issueType,
      amount_cents: amountCents,
      currency: 'USD',
      transaction_date: wizardData.transactionDate || undefined,
      payment_method: wizardData.paymentMethod || undefined,
      merchant_name: wizardData.merchantName || undefined,
      merchant_url: data?.original_url,
      description: wizardData.description || undefined,
      desired_outcome: wizardData.desiredOutcome || undefined,
      locale: wizardData.locale,
    });
  }, [wizardData, token, data?.original_url, submitCase]);

  const canProceed = useMemo(() => {
    switch (wizardStep) {
      case 0: return !!wizardData.issueType;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return !!wizardData.desiredOutcome;
      default: return false;
    }
  }, [wizardStep, wizardData]);

  useEffect(() => {
    if (Platform.OS === 'web' && data) {
      const badgeText = data.badge || 'UNSCANNED';
      const scoreText = data.score !== null ? ` | Score: ${data.score}/100` : '';
      document.title = `${badgeText}${scoreText} - REAiL Safety Report`;

      const setMeta = (property: string, content: string) => {
        let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.content = content;
      };

      setMeta('og:title', `${badgeText} - REAiL Safety Report`);
      setMeta('og:description', `${data.domain}${scoreText}${data.top_red_flags.length > 0 ? ` | ${data.top_red_flags.length} flag(s)` : ''}`);
      setMeta('og:type', 'website');
      setMeta('og:url', window.location.href);
      setMeta('og:image', 'https://reail.app/og/default-share.png');
    }
  }, [data]);

  const renderWizardStep = () => {
    const wEs = wizardData.locale === 'es';
    switch (wizardStep) {
      case 0:
        return (
          <View style={styles.wizardStepContent}>
            <Text style={styles.wizardStepTitle}>
              {wEs ? '¿Qué pasó?' : 'What happened?'}
            </Text>
            <Text style={styles.wizardStepSubtitle}>
              {wEs ? 'Selecciona el tipo de problema' : 'Select the issue type'}
            </Text>
            <View style={styles.optionsGrid}>
              {ISSUE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    wizardData.issueType === opt.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => setWizardData(prev => ({ ...prev, issueType: opt.value }))}
                  testID={`issue-${opt.value}`}
                >
                  <Text style={[
                    styles.optionButtonText,
                    wizardData.issueType === opt.value && styles.optionButtonTextSelected,
                  ]}>
                    {wEs ? opt.labelEs : opt.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      
      case 1:
        return (
          <View style={styles.wizardStepContent}>
            <Text style={styles.wizardStepTitle}>
              {wEs ? 'Monto y fecha' : 'Amount & Date'}
            </Text>
            <Text style={styles.wizardStepSubtitle}>
              {wEs ? 'Opcional pero ayuda a tu caso' : 'Optional but helps your case'}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{wEs ? 'Monto' : 'Amount'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="$0.00"
                placeholderTextColor={Colors.textTertiary}
                value={wizardData.amount}
                onChangeText={(text) => setWizardData(prev => ({ ...prev, amount: text }))}
                keyboardType="decimal-pad"
                testID="amount-input"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{wEs ? 'Fecha de transacción' : 'Transaction Date'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
                value={wizardData.transactionDate}
                onChangeText={(text) => setWizardData(prev => ({ ...prev, transactionDate: text }))}
                testID="date-input"
              />
            </View>
          </View>
        );
      
      case 2:
        return (
          <View style={styles.wizardStepContent}>
            <Text style={styles.wizardStepTitle}>
              {wEs ? 'Método de pago' : 'Payment Method'}
            </Text>
            <Text style={styles.wizardStepSubtitle}>
              {wEs ? '¿Cómo pagaste?' : 'How did you pay?'}
            </Text>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionsGrid}>
                {PAYMENT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      wizardData.paymentMethod === opt.value && styles.optionButtonSelected,
                    ]}
                    onPress={() => setWizardData(prev => ({ ...prev, paymentMethod: opt.value }))}
                    testID={`payment-${opt.value}`}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      wizardData.paymentMethod === opt.value && styles.optionButtonTextSelected,
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      
      case 3:
        return (
          <View style={styles.wizardStepContent}>
            <Text style={styles.wizardStepTitle}>
              {wEs ? 'Comercio / Sitio' : 'Merchant / Site'}
            </Text>
            <Text style={styles.wizardStepSubtitle}>
              {wEs ? '¿Dónde hiciste la compra?' : 'Where did you make the purchase?'}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{wEs ? 'Nombre del comercio' : 'Merchant Name'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={wEs ? 'Ej: TiendaXYZ' : 'E.g. ShopXYZ'}
                placeholderTextColor={Colors.textTertiary}
                value={wizardData.merchantName}
                onChangeText={(text) => setWizardData(prev => ({ ...prev, merchantName: text }))}
                testID="merchant-input"
              />
            </View>
          </View>
        );
      
      case 4:
        return (
          <View style={styles.wizardStepContent}>
            <Text style={styles.wizardStepTitle}>
              {wEs ? 'Descripción (opcional)' : 'Description (optional)'}
            </Text>
            <Text style={styles.wizardStepSubtitle}>
              {wEs ? 'Agrega detalles sobre lo que pasó' : 'Add details about what happened'}
            </Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={wEs ? 'Describe lo que pasó...' : 'Describe what happened...'}
                placeholderTextColor={Colors.textTertiary}
                value={wizardData.description}
                onChangeText={(text) => setWizardData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="description-input"
              />
            </View>
            <Text style={styles.proofNote}>
              {wEs ? '📎 Puedes agregar capturas de pantalla después' : '📎 You can add screenshots later'}
            </Text>
          </View>
        );
      
      case 5:
        return (
          <View style={styles.wizardStepContent}>
            <Text style={styles.wizardStepTitle}>
              {wEs ? '¿Qué resultado deseas?' : 'Desired Outcome'}
            </Text>
            <Text style={styles.wizardStepSubtitle}>
              {wEs ? 'Selecciona tu resolución preferida' : 'Select your preferred resolution'}
            </Text>
            <View style={styles.optionsGrid}>
              {OUTCOME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    wizardData.desiredOutcome === opt.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => setWizardData(prev => ({ ...prev, desiredOutcome: opt.value }))}
                  testID={`outcome-${opt.value}`}
                >
                  <Text style={[
                    styles.optionButtonText,
                    wizardData.desiredOutcome === opt.value && styles.optionButtonTextSelected,
                  ]}>
                    {wEs ? opt.labelEs : opt.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false, title: 'REAiL Safety Report' }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Logo size="small" />
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
            <Text style={styles.loadingText}>
              {isEs ? 'Cargando reporte de seguridad...' : 'Loading safety report...'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Logo size="small" />
            <ShieldAlert size={64} color={Colors.highRisk} style={styles.errorIcon} />
            <Text style={styles.errorTitle}>
              {isEs ? 'Enlace no encontrado' : 'Link Not Found'}
            </Text>
            <Text style={styles.errorText}>
              {isEs
                ? 'Este enlace compartido puede haber expirado o no existe.'
                : 'This share link may have expired or does not exist.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} testID="retry-btn">
              <RefreshCw size={18} color={Colors.text} />
              <Text style={styles.retryText}>{isEs ? 'Reintentar' : 'Try Again'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/')}>
              <Text style={styles.homeText}>{isEs ? 'Ir al inicio' : 'Go to Home'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: `${data.badge || 'Safety'} Report - REAiL`,
        }} 
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Logo size="small" />
              <View style={styles.langToggleSmall}>
                <TouchableOpacity
                  style={[styles.langBtnSmall, uiLocale === 'en' && styles.langBtnSmallActive]}
                  onPress={() => setUiLocale('en')}
                >
                  <Text style={[styles.langBtnSmallText, uiLocale === 'en' && styles.langBtnSmallTextActive]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtnSmall, uiLocale === 'es' && styles.langBtnSmallActive]}
                  onPress={() => setUiLocale('es')}
                >
                  <Text style={[styles.langBtnSmallText, uiLocale === 'es' && styles.langBtnSmallTextActive]}>ES</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {isEs ? 'Reporte de Seguridad' : 'Safety Report'}
            </Text>
          </View>

          <View style={styles.content}>
            <View style={[styles.badgeCard, { borderColor: config.color }]}>
              <View style={[styles.badgeIconContainer, { backgroundColor: config.bg }]}>
                <BadgeIcon size={48} color={config.color} />
              </View>
              <Text style={[styles.badgeLabel, { color: config.color }]}>
                {isEs ? config.labelEs : config.labelEn}
              </Text>
              {data.score !== null && (
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>
                    {isEs ? 'Puntuación' : 'Trust Score'}
                  </Text>
                  <Text style={[styles.scoreValue, { color: config.color }]}>{data.score}/100</Text>
                </View>
              )}
            </View>

            <View style={styles.urlCard}>
              <Text style={styles.urlLabel}>{isEs ? 'Enlace escaneado' : 'Scanned Link'}</Text>
              <Text style={styles.urlDomain} numberOfLines={1}>{data.domain}</Text>
              <Text style={styles.urlFull} numberOfLines={2}>{data.original_url}</Text>
            </View>

            {data.top_red_flags && data.top_red_flags.length > 0 && (
              <View style={styles.flagsCard}>
                <Text style={styles.flagsTitle}>
                  {isEs ? 'Alertas detectadas' : 'Red Flags Detected'}
                </Text>
                {data.top_red_flags.map((flag, idx) => (
                  <View key={idx} style={styles.flagRow}>
                    <AlertTriangle size={16} color={Colors.unverified} />
                    <Text style={styles.flagText}>{flag}</Text>
                  </View>
                ))}
              </View>
            )}

            {data.next_action && (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>
                  {isEs ? 'Acción recomendada' : 'Recommended Action'}
                </Text>
                <Text style={styles.actionText}>{data.next_action}</Text>
              </View>
            )}

            {(badgeKey === 'HIGH_RISK' || badgeKey === 'UNVERIFIED') && (
              <TouchableOpacity 
                style={styles.paidButton}
                onPress={handleStartWizard}
                activeOpacity={0.85}
                testID="paid-cta"
              >
                <DollarSign size={20} color={Colors.text} />
                <View style={styles.paidButtonTextContainer}>
                  <Text style={styles.paidButtonText}>
                    {isEs ? 'Ya pagué y necesito ayuda' : 'I already paid and need help'}
                  </Text>
                  <Text style={styles.paidButtonSubtext}>
                    {isEs ? 'Genera tu kit de reembolso gratis' : 'Generate your free refund kit'}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.text} />
              </TouchableOpacity>
            )}

            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: Colors.primary }]} 
                onPress={handleShare}
                activeOpacity={0.85}
                testID="share-btn"
              >
                <Share2 size={20} color={Colors.text} />
                <Text style={styles.primaryButtonText}>
                  {isEs ? 'Compartir reporte' : 'Share This Report'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => router.push('/')}
                activeOpacity={0.85}
                testID="scan-own-btn"
              >
                <Shield size={18} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>
                  {isEs ? 'Escanea tu propio enlace' : 'Scan Your Own Link'}
                </Text>
                <ArrowRight size={16} color={Colors.primary} />
              </TouchableOpacity>

              {data.badge === 'VERIFIED' && (
                <TouchableOpacity 
                  style={styles.linkButton} 
                  onPress={handleOpenLink}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={16} color={Colors.textSecondary} />
                  <Text style={styles.linkButtonText}>
                    {isEs ? 'Abrir enlace original' : 'Open Original Link'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerText}>
                {isEs
                  ? 'Verificación basada en riesgo usando señales públicas + análisis automatizado. No es verdad absoluta. REAiL no garantiza resultados específicos.'
                  : 'Risk-based verification using public signals + automated analysis. Not absolute truth. REAiL does not guarantee specific outcomes.'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.appealLink}
              onPress={() => router.push(`/appeal?token=${encodeURIComponent(token || '')}` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.appealLinkText}>
                {isEs
                  ? '¿Eres el negocio/creador? Envía evidencia para corregir este resultado.'
                  : 'Are you the business/creator? Submit evidence to correct this result.'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {isEs
                  ? `Visto ${data.view_count ? `${data.view_count} veces` : 'recientemente'}`
                  : `Scanned ${data.view_count ? `${data.view_count} times` : 'recently'}`}
              </Text>
              <Text style={styles.footerPowered}>Powered by REAiL Systems</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showWizard}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWizard(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowWizard(false)} style={styles.closeButton}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {wizardData.locale === 'es' ? 'Recupera tu dinero' : 'Get Your Money Back'}
              </Text>
              <View style={styles.langToggle}>
                <TouchableOpacity
                  style={[styles.langButton, wizardData.locale === 'en' && styles.langButtonActive]}
                  onPress={() => setWizardData(prev => ({ ...prev, locale: 'en' }))}
                >
                  <Text style={[styles.langButtonText, wizardData.locale === 'en' && styles.langButtonTextActive]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langButton, wizardData.locale === 'es' && styles.langButtonActive]}
                  onPress={() => setWizardData(prev => ({ ...prev, locale: 'es' }))}
                >
                  <Text style={[styles.langButtonText, wizardData.locale === 'es' && styles.langButtonTextActive]}>ES</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.progressBar}>
              {[0, 1, 2, 3, 4, 5].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.progressDot,
                    step <= wizardStep && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.wizardContent}>
              {renderWizardStep()}
            </View>

            {createCaseMutation.isError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>
                  {wizardData.locale === 'es'
                    ? 'Error al crear el caso. Intenta de nuevo.'
                    : 'Failed to create case. Please try again.'}
                </Text>
              </View>
            )}

            <View style={styles.wizardFooter}>
              {wizardStep > 0 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setWizardStep(prev => prev - 1)}
                >
                  <ChevronLeft size={20} color={Colors.text} />
                  <Text style={styles.backButtonText}>
                    {wizardData.locale === 'es' ? 'Atrás' : 'Back'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              {wizardStep < 5 ? (
                <TouchableOpacity
                  style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
                  onPress={() => canProceed && setWizardStep(prev => prev + 1)}
                  disabled={!canProceed}
                  testID="wizard-next"
                >
                  <Text style={styles.nextButtonText}>
                    {wizardData.locale === 'es' ? 'Siguiente' : 'Next'}
                  </Text>
                  <ChevronRight size={20} color={Colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.submitButton, (!canProceed || createCaseMutation.isPending) && styles.nextButtonDisabled]}
                  onPress={handleSubmitCase}
                  disabled={!canProceed || createCaseMutation.isPending}
                  testID="wizard-submit"
                >
                  {createCaseMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.text} />
                  ) : (
                    <>
                      <FileText size={18} color={Colors.text} />
                      <Text style={styles.submitButtonText}>
                        {wizardData.locale === 'es' ? 'Generar Rail Pack' : 'Generate Rail Pack'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  langToggleSmall: {
    position: 'absolute' as const,
    right: 16,
    flexDirection: 'row',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 6,
    padding: 2,
  },
  langBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  langBtnSmallActive: {
    backgroundColor: Colors.primary,
  },
  langBtnSmallText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  langBtnSmallTextActive: {
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginTop: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    marginTop: 32,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  homeButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  homeText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  badgeCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeLabel: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  urlCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  urlLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  urlDomain: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  urlFull: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  flagsCard: {
    backgroundColor: Colors.unverifiedBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.unverified,
    padding: 16,
    marginBottom: 16,
  },
  flagsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.unverified,
    marginBottom: 12,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  flagText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 12,
    color: Colors.accent,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontWeight: '600' as const,
  },
  actionText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  paidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.highRisk,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  paidButtonTextContainer: {
    flex: 1,
  },
  paidButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  paidButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  buttonsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  linkButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  disclaimerCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textTertiary,
    lineHeight: 16,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  footerPowered: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  appealLink: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appealLinkText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 8,
    padding: 2,
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  langButtonActive: {
    backgroundColor: Colors.primary,
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  langButtonTextActive: {
    color: Colors.text,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  wizardContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  wizardStepContent: {
    flex: 1,
    paddingTop: 20,
  },
  wizardStepTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  wizardStepSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionsScroll: {
    flex: 1,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  optionButtonSelected: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  optionButtonTextSelected: {
    color: Colors.text,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
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
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top' as const,
  },
  proofNote: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
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
    textAlign: 'center',
  },
  wizardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 15,
    color: Colors.text,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.verified,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
