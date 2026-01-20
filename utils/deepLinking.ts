import * as Linking from 'expo-linking';
import { Share } from 'react-native';
import { ScanResult } from '@/types/scan';

const APP_SCHEME = 'reailscan';
const WEB_URL = 'https://reail.app';

export function createScanDeepLink(scanId: string): string {
  return Linking.createURL(`result/${scanId}`, {
    scheme: APP_SCHEME,
  });
}

export function createWebShareLink(scan: ScanResult): string {
  return `${WEB_URL}/scan/${scan.id}`;
}

export function parseScanIdFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.path?.startsWith('result/')) {
      return parsed.path.replace('result/', '');
    }
    if (parsed.path?.startsWith('scan/')) {
      return parsed.path.replace('scan/', '');
    }
    if (parsed.queryParams?.scanId) {
      return parsed.queryParams.scanId as string;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildShareMessage(scan: ScanResult, language: 'en' | 'es' = 'en'): string {
  const badgeEmoji = scan.badge === 'VERIFIED' ? '✅' : scan.badge === 'UNVERIFIED' ? '⚠️' : '❌';
  const badgeText = {
    en: {
      VERIFIED: 'Verified',
      UNVERIFIED: 'Unverified',
      HIGH_RISK: 'High Risk',
    },
    es: {
      VERIFIED: 'Verificado',
      UNVERIFIED: 'No verificado',
      HIGH_RISK: 'Alto riesgo',
    },
  };

  const messages = {
    en: {
      title: 'REAiL Scan Result',
      domain: 'Domain',
      score: 'Trust Score',
      status: 'Status',
      footer: 'Scan any link at reail.app',
      verifiedBy: 'Verified by REAiL Scan',
    },
    es: {
      title: 'Resultado REAiL Scan',
      domain: 'Dominio',
      score: 'Puntuación de confianza',
      status: 'Estado',
      footer: 'Escanea cualquier enlace en reail.app',
      verifiedBy: 'Verificado por REAiL Scan',
    },
  };

  const t = messages[language];
  const badge = badgeText[language][scan.badge];

  return `${badgeEmoji} ${t.title}

${t.domain}: ${scan.domain}
${t.score}: ${scan.score}/100
${t.status}: ${badge}

${t.verifiedBy}

${t.footer}`;
}

export async function shareResult(scan: ScanResult, language: 'en' | 'es' = 'en'): Promise<boolean> {
  try {
    const message = buildShareMessage(scan, language);
    const result = await Share.share({
      message,
      title: 'REAiL Scan Result',
    });
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.log('[DeepLinking] Share error:', error);
    return false;
  }
}

export async function openUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.log('[DeepLinking] Open URL error:', error);
    return false;
  }
}

export function getInitialUrl(): Promise<string | null> {
  return Linking.getInitialURL();
}

export function addUrlListener(callback: (url: string) => void): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    callback(event.url);
  });
  
  return () => subscription.remove();
}
