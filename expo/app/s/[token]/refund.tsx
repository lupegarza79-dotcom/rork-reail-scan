import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Copy,
  Check,
  Mail,
  Clock,
  AlertTriangle,
  Scale,
  FileCheck,
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
      'File a chargeback or dispute with your bank/card issuer',
      'Report to FTC at reportfraud.ftc.gov',
      'File BBB complaint at bbb.org',
      'Report to your state Attorney General',
      'For PayPal/Venmo/CashApp: open a dispute in the app',
      'For crypto: report to IC3.gov (FBI Internet Crime)',
      'Document everything: screenshots, emails, transaction IDs',
    ],

    evidence: [
      'Screenshot of the original offer/listing',
      'Transaction receipt or bank statement',
      'Screenshots of all communications',
      'URL of the website/listing',
      'Date and amount of transaction',
      'Payment method used',
      'Any confirmation emails received',
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
      'Presenta un contracargo con tu banco/emisor de tarjeta',
      'Reporta a PROFECO (profeco.gob.mx) o equivalente',
      'Presenta queja ante la CONDUSEF si es servicio financiero',
      'Reporta al Ministerio Público si es fraude',
      'Para PayPal/Venmo/CashApp: abre disputa en la app',
      'Para crypto: reporta a la policía cibernética',
      'Documenta todo: capturas, correos, IDs de transacción',
    ],

    evidence: [
      'Captura de la oferta/publicación original',
      'Recibo de transacción o estado de cuenta',
      'Capturas de todas las comunicaciones',
      'URL del sitio web/publicación',
      'Fecha y monto de la transacción',
      'Método de pago utilizado',
      'Correos de confirmación recibidos',
    ],
  },
};

interface SectionConfig {
  id: string;
  titleEn: string;
  titleEs: string;
  Icon: typeof Mail;
  iconColor: string;
  type: 'template' | 'list';
  templateKey?: 'refund' | 'followup' | 'finalNotice';
  listKey?: 'escalation' | 'evidence';
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'refund',
    titleEn: 'Refund Request (Day 0)',
    titleEs: 'Solicitud de Reembolso (Día 0)',
    Icon: Mail,
    iconColor: Colors.primary,
    type: 'template',
    templateKey: 'refund',
  },
  {
    id: 'followup',
    titleEn: 'Follow-up (Day +3)',
    titleEs: 'Seguimiento (Día +3)',
    Icon: Clock,
    iconColor: Colors.unverified,
    type: 'template',
    templateKey: 'followup',
  },
  {
    id: 'final',
    titleEn: 'Final Notice (Day +7)',
    titleEs: 'Aviso Final (Día +7)',
    Icon: AlertTriangle,
    iconColor: Colors.highRisk,
    type: 'template',
    templateKey: 'finalNotice',
  },
  {
    id: 'escalation',
    titleEn: 'Escalation Steps',
    titleEs: 'Pasos de Escalación',
    Icon: Scale,
    iconColor: Colors.accent,
    type: 'list',
    listKey: 'escalation',
  },
  {
    id: 'evidence',
    titleEn: 'Evidence Checklist',
    titleEs: 'Checklist de Evidencia',
    Icon: FileCheck,
    iconColor: Colors.verified,
    type: 'list',
    listKey: 'evidence',
  },
];

function detectLocale(): 'en' | 'es' {
  if (Platform.OS === 'web') {
    try {
      const lang = navigator.language || '';
      if (lang.startsWith('es')) return 'es';
    } catch {}
  }
  return 'en';
}

export default function RefundScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [locale, setLocale] = useState<'en' | 'es'>(detectLocale);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
            {SECTIONS.map((section) => {
              const SectionIcon = section.Icon;
              const isCopied = copiedField === section.id;

              return (
                <View key={section.id} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <SectionIcon size={18} color={section.iconColor} />
                    <Text style={styles.sectionTitle}>
                      {isEs ? section.titleEs : section.titleEn}
                    </Text>
                  </View>

                  {section.type === 'template' && section.templateKey && (
                    <View style={styles.templateArea}>
                      <Text style={styles.templateText} selectable>
                        {t[section.templateKey]}
                      </Text>
                      <TouchableOpacity
                        style={styles.copyRow}
                        onPress={() => handleCopy(t[section.templateKey!], section.id)}
                        testID={`copy-${section.id}`}
                      >
                        {isCopied ? (
                          <Check size={15} color={Colors.verified} />
                        ) : (
                          <Copy size={15} color={Colors.primary} />
                        )}
                        <Text style={[styles.copyText, isCopied && { color: Colors.verified }]}>
                          {isCopied ? (isEs ? 'Copiado' : 'Copied') : (isEs ? 'Copiar' : 'Copy')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {section.type === 'list' && section.listKey && (
                    <View style={styles.listArea}>
                      {t[section.listKey].map((item, idx) => (
                        <View key={idx} style={styles.listRow}>
                          <Text style={styles.listBullet}>{section.listKey === 'evidence' ? '☐' : `${idx + 1}.`}</Text>
                          <Text style={styles.listText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                {isEs
                  ? 'Estas plantillas son orientativas y no constituyen asesoría legal. Consulta con un profesional legal si es necesario.'
                  : 'These templates are for guidance only and do not constitute legal advice. Consult a legal professional if needed.'}
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
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 14,
    overflow: 'hidden' as const,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  templateArea: {
    padding: 12,
  },
  templateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-end' as const,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 8,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  listArea: {
    padding: 14,
    gap: 8,
  },
  listRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  listBullet: {
    fontSize: 13,
    color: Colors.textTertiary,
    width: 20,
  },
  listText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
    flex: 1,
  },
  disclaimer: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
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
