import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  Mail,
  Clock,
  AlertTriangle,
  Scale,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';

const TEMPLATES = {
  en: {
    refund: `Subject: Refund Request — Order/Transaction [DATE]

Dear Customer Support,

I am writing to formally request a full refund for a transaction made on [DATE] in the amount of [AMOUNT].

After review, I believe this charge is unauthorized / the product was not as described / I did not receive what was promised.

I request that this refund be processed within 5 business days. If I do not receive confirmation, I will escalate this matter to my bank/payment provider and relevant consumer protection agencies.

Please confirm receipt of this request.

Sincerely,
[YOUR NAME]`,

    followup: `Subject: Follow-Up — Refund Request from [DATE]

Dear Customer Support,

I am following up on my refund request submitted on [DATE]. I have not received a response or confirmation of my refund.

Please process this refund immediately. If I do not hear back within 48 hours, I will proceed with a formal dispute through my payment provider.

Regards,
[YOUR NAME]`,

    finalNotice: `Subject: FINAL NOTICE — Unresolved Refund Request

Dear Customer Support,

This is my final notice regarding my refund request originally submitted on [DATE]. Despite previous attempts, this matter remains unresolved.

I am now escalating this dispute. I will:
1. File a chargeback/dispute with my bank or payment provider
2. Report this to the FTC (reportfraud.ftc.gov) or equivalent agency
3. File a complaint with the Better Business Bureau (BBB)

You have 48 hours to resolve this before I proceed.

[YOUR NAME]`,

    escalation: [
      '1. File a chargeback or dispute with your bank/card issuer',
      '2. Report to FTC at reportfraud.ftc.gov',
      '3. File BBB complaint at bbb.org',
      '4. Report to your state Attorney General',
      '5. For PayPal/Venmo/CashApp: open a dispute in the app',
      '6. For crypto: report to IC3.gov (FBI Internet Crime)',
      '7. Document everything: screenshots, emails, transaction IDs',
    ],

    evidence: [
      '☐ Screenshot of the original offer/listing',
      '☐ Transaction receipt or bank statement',
      '☐ Screenshots of all communications',
      '☐ URL of the website/listing',
      '☐ Date and amount of transaction',
      '☐ Payment method used',
      '☐ Any confirmation emails received',
    ],
  },
  es: {
    refund: `Asunto: Solicitud de Reembolso — Orden/Transacción [FECHA]

Estimado Servicio al Cliente,

Escribo para solicitar formalmente un reembolso completo por una transacción realizada el [FECHA] por un monto de [MONTO].

Después de revisar, considero que este cargo es no autorizado / el producto no fue como se describió / no recibí lo prometido.

Solicito que este reembolso sea procesado en 5 días hábiles. Si no recibo confirmación, escalaré este asunto a mi banco/proveedor de pago y agencias de protección al consumidor.

Por favor confirme recibo de esta solicitud.

Atentamente,
[TU NOMBRE]`,

    followup: `Asunto: Seguimiento — Solicitud de Reembolso del [FECHA]

Estimado Servicio al Cliente,

Doy seguimiento a mi solicitud de reembolso enviada el [FECHA]. No he recibido respuesta ni confirmación de mi reembolso.

Por favor procese este reembolso de inmediato. Si no recibo respuesta en 48 horas, procederé con una disputa formal a través de mi proveedor de pago.

Saludos,
[TU NOMBRE]`,

    finalNotice: `Asunto: AVISO FINAL — Solicitud de Reembolso Sin Resolver

Estimado Servicio al Cliente,

Este es mi aviso final respecto a mi solicitud de reembolso enviada originalmente el [FECHA]. A pesar de intentos previos, este asunto sigue sin resolverse.

Ahora estoy escalando esta disputa. Procederé a:
1. Presentar un contracargo/disputa con mi banco
2. Reportar a PROFECO o la agencia equivalente
3. Presentar queja ante la autoridad de protección al consumidor

Tienen 48 horas para resolver esto antes de que proceda.

[TU NOMBRE]`,

    escalation: [
      '1. Presenta un contracargo con tu banco/emisor de tarjeta',
      '2. Reporta a PROFECO (profeco.gob.mx) o equivalente',
      '3. Presenta queja ante la CONDUSEF si es servicio financiero',
      '4. Reporta al Ministerio Público si es fraude',
      '5. Para PayPal/Venmo/CashApp: abre disputa en la app',
      '6. Para crypto: reporta a la policía cibernética',
      '7. Documenta todo: capturas, correos, IDs de transacción',
    ],

    evidence: [
      '☐ Captura de la oferta/publicación original',
      '☐ Recibo de transacción o estado de cuenta',
      '☐ Capturas de todas las comunicaciones',
      '☐ URL del sitio web/publicación',
      '☐ Fecha y monto de la transacción',
      '☐ Método de pago utilizado',
      '☐ Correos de confirmación recibidos',
    ],
  },
};

interface TimelineStep {
  id: string;
  dayEn: string;
  dayEs: string;
  titleEn: string;
  titleEs: string;
  Icon: typeof Mail;
  iconColor: string;
  templateKey: 'refund' | 'followup' | 'finalNotice' | null;
}

const TIMELINE: TimelineStep[] = [
  {
    id: 'day0',
    dayEn: 'Day 0',
    dayEs: 'Día 0',
    titleEn: 'Send Refund Request',
    titleEs: 'Enviar solicitud de reembolso',
    Icon: Mail,
    iconColor: Colors.primary,
    templateKey: 'refund',
  },
  {
    id: 'day3',
    dayEn: 'Day +3',
    dayEs: 'Día +3',
    titleEn: 'Send Follow-up',
    titleEs: 'Enviar seguimiento',
    Icon: Clock,
    iconColor: Colors.unverified,
    templateKey: 'followup',
  },
  {
    id: 'day7',
    dayEn: 'Day +7',
    dayEs: 'Día +7',
    titleEn: 'Final Notice',
    titleEs: 'Aviso final',
    Icon: AlertTriangle,
    iconColor: Colors.highRisk,
    templateKey: 'finalNotice',
  },
  {
    id: 'escalate',
    dayEn: '',
    dayEs: '',
    titleEn: 'Escalation Steps',
    titleEs: 'Pasos de escalación',
    Icon: Scale,
    iconColor: Colors.accent,
    templateKey: null,
  },
];

export default function RefundScreen() {
  const { token, locale: paramLocale } = useLocalSearchParams<{
    token: string;
    locale: string;
  }>();
  const router = useRouter();

  const [locale, setLocale] = useState<'en' | 'es'>((paramLocale as 'en' | 'es') || 'en');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({ day0: true });

  const isEs = locale === 'es';
  const t = isEs ? TEMPLATES.es : TEMPLATES.en;

  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(field);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.log('[Refund] Copy error:', err);
    }
  }, []);

  const handleSharePack = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const shareUrl = Platform.OS === 'web'
      ? window.location.href
      : `https://reail.app/s/${token}/refund`;

    const message = isEs
      ? `Mi kit de reembolso generado por REAiL: ${shareUrl}`
      : `My refund kit from REAiL: ${shareUrl}`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: 'REAiL Refund Kit', text: message, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          setCopiedField('share-url');
          setTimeout(() => setCopiedField(null), 2000);
        }
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      console.log('[Refund] Share error:', err);
    }
  }, [token, isEs]);

  const toggleCard = useCallback((cardId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  }, []);

  const CopyButton = useMemo(() => {
    return ({ text, field, label }: { text: string; field: string; label?: string }) => (
      <TouchableOpacity
        style={styles.copyBtn}
        onPress={() => handleCopy(text, field)}
      >
        {copiedField === field ? (
          <Check size={16} color={Colors.verified} />
        ) : (
          <Copy size={16} color={Colors.primary} />
        )}
        <Text style={[styles.copyBtnText, copiedField === field && { color: Colors.verified }]}>
          {copiedField === field
            ? (isEs ? 'Copiado' : 'Copied')
            : (label || (isEs ? 'Copiar' : 'Copy'))}
        </Text>
      </TouchableOpacity>
    );
  }, [copiedField, isEs, handleCopy]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="refund-back">
            <ArrowLeft size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Shield size={16} color={Colors.primary} />
            <Text style={styles.topBarTitle}>
              {isEs ? 'Kit de Reembolso' : 'Refund Kit'}
            </Text>
          </View>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langChip, locale === 'en' && styles.langChipActive]}
              onPress={() => setLocale('en')}
            >
              <Text style={[styles.langText, locale === 'en' && styles.langTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langChip, locale === 'es' && styles.langChipActive]}
              onPress={() => setLocale('es')}
            >
              <Text style={[styles.langText, locale === 'es' && styles.langTextActive]}>ES</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>
                {isEs ? '¿Ya pagaste?' : 'Already paid?'}
              </Text>
              <Text style={styles.introText}>
                {isEs
                  ? 'Sigue esta línea de tiempo para recuperar tu dinero. Copia las plantillas y envíalas al comercio.'
                  : 'Follow this timeline to get your money back. Copy the templates and send them to the merchant.'}
              </Text>
            </View>

            {TIMELINE.map((step, idx) => {
              const isExpanded = !!expandedCards[step.id];
              const StepIcon = step.Icon;
              const isLast = idx === TIMELINE.length - 1;

              return (
                <View key={step.id} style={styles.timelineItem}>
                  <View style={styles.timelineSide}>
                    <View style={[styles.dot, { backgroundColor: step.iconColor }]} />
                    {!isLast && <View style={styles.connector} />}
                  </View>

                  <View style={[styles.card, isExpanded && { borderColor: step.iconColor + '60' }]}>
                    <TouchableOpacity
                      style={styles.cardHeader}
                      onPress={() => toggleCard(step.id)}
                      activeOpacity={0.7}
                      testID={`timeline-${step.id}`}
                    >
                      <StepIcon size={20} color={step.iconColor} />
                      <View style={styles.cardTitleArea}>
                        {(step.dayEn || step.dayEs) ? (
                          <Text style={[styles.dayLabel, { color: step.iconColor }]}>
                            {isEs ? step.dayEs : step.dayEn}
                          </Text>
                        ) : null}
                        <Text style={styles.cardTitle}>
                          {isEs ? step.titleEs : step.titleEn}
                        </Text>
                      </View>
                      {isExpanded
                        ? <ChevronUp size={18} color={Colors.textTertiary} />
                        : <ChevronDown size={18} color={Colors.textTertiary} />}
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.cardBody}>
                        {step.templateKey && step.templateKey !== 'finalNotice' && (
                          <>
                            <Text style={styles.instructions}>
                              {step.id === 'day0'
                                ? (isEs
                                  ? 'Copia y envía esta plantilla al servicio al cliente por email o formulario web.'
                                  : 'Copy and send this template to customer service via email or web form.')
                                : (isEs
                                  ? 'Si no recibes respuesta en 3 días hábiles, envía este seguimiento.'
                                  : 'If no response within 3 business days, send this follow-up.')}
                            </Text>
                            <View style={styles.templateBox}>
                              <View style={styles.templateHeader}>
                                <Text style={styles.templateLabel}>
                                  {step.id === 'day0'
                                    ? (isEs ? 'Solicitud de reembolso' : 'Refund Request')
                                    : (isEs ? 'Seguimiento' : 'Follow-up')}
                                </Text>
                                <CopyButton text={t[step.templateKey]} field={step.id} />
                              </View>
                              <Text style={styles.templateText} selectable>
                                {t[step.templateKey]}
                              </Text>
                            </View>
                          </>
                        )}

                        {step.id === 'day7' && (
                          <>
                            <Text style={styles.instructions}>
                              {isEs
                                ? 'Sin respuesta después de 7 días. Envía el aviso final y procede con la escalación.'
                                : 'No response after 7 days. Send final notice and proceed with escalation.'}
                            </Text>
                            <View style={styles.templateBox}>
                              <View style={styles.templateHeader}>
                                <Text style={styles.templateLabel}>
                                  {isEs ? 'Aviso final' : 'Final Notice'}
                                </Text>
                                <CopyButton text={t.finalNotice} field="final" />
                              </View>
                              <Text style={styles.templateText} selectable>
                                {t.finalNotice}
                              </Text>
                            </View>
                          </>
                        )}

                        {step.id === 'escalate' && (
                          <View style={styles.listContainer}>
                            {t.escalation.map((item, i) => (
                              <Text key={i} style={styles.listItem}>{item}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <View style={styles.sectionHeader}>
              <FileCheck size={16} color={Colors.accent} />
              <Text style={styles.sectionTitle}>
                {isEs ? 'Checklist de evidencia' : 'Evidence Checklist'}
              </Text>
            </View>
            <View style={styles.evidenceCard}>
              {t.evidence.map((item, idx) => (
                <Text key={idx} style={styles.evidenceItem}>{item}</Text>
              ))}
            </View>

            <TouchableOpacity
              style={styles.sharePackBtn}
              onPress={handleSharePack}
              activeOpacity={0.85}
              testID="share-pack-btn"
            >
              <Share2 size={20} color="white" />
              <Text style={styles.sharePackText}>
                {copiedField === 'share-url'
                  ? (isEs ? 'Enlace copiado' : 'Link Copied')
                  : (isEs ? 'Compartir kit' : 'Share Refund Kit')}
              </Text>
            </TouchableOpacity>

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerTitle}>
                {isEs ? 'Aviso legal' : 'Legal Disclaimer'}
              </Text>
              <Text style={styles.disclaimerText}>
                {isEs
                  ? 'Estas plantillas son orientativas y no constituyen asesoría legal. REAiL no garantiza resultados específicos. Consulta con un profesional legal si es necesario.'
                  : 'These templates are for guidance only and do not constitute legal advice. REAiL does not guarantee specific outcomes. Consult a legal professional if needed.'}
              </Text>
            </View>

            <View style={styles.footerArea}>
              <Text style={styles.footerText}>REAiL Scan</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  topBarCenter: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  langRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 6,
    padding: 2,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  langChipActive: {
    backgroundColor: Colors.primary,
  },
  langText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  langTextActive: {
    color: 'white',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  introText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row' as const,
    marginBottom: 4,
  },
  timelineSide: {
    width: 24,
    alignItems: 'center' as const,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginLeft: 8,
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 10,
  },
  cardTitleArea: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  instructions: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  templateBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  templateHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundTertiary,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  templateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    padding: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  evidenceCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 8,
    marginBottom: 20,
  },
  evidenceItem: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  sharePackBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    marginBottom: 16,
  },
  sharePackText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: 'white',
  },
  disclaimer: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  footerArea: {
    alignItems: 'center' as const,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
  },
});
