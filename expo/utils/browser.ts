import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Colors from '@/constants/colors';

export interface BrowserOptions {
  showTitle?: boolean;
  enableBarCollapsing?: boolean;
  controlsColor?: string;
  toolbarColor?: string;
}

export async function openInAppBrowser(url: string, options?: BrowserOptions): Promise<boolean> {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log('[Browser] Opening URL:', url);

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return true;
    }

    const result = await WebBrowser.openBrowserAsync(url, {
      showTitle: options?.showTitle ?? true,
      enableBarCollapsing: options?.enableBarCollapsing ?? true,
      controlsColor: options?.controlsColor ?? Colors.primary,
      toolbarColor: options?.toolbarColor ?? Colors.background,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });

    console.log('[Browser] Result:', result.type);
    return result.type === 'cancel' || result.type === 'dismiss';
  } catch (error) {
    console.log('[Browser] Error opening URL:', error);
    return false;
  }
}

export async function openScannedLink(url: string): Promise<boolean> {
  return openInAppBrowser(url, {
    showTitle: true,
    enableBarCollapsing: true,
  });
}

export function warmUpBrowser(): void {
  if (Platform.OS !== 'web') {
    WebBrowser.warmUpAsync().catch(() => {});
  }
}

export function coolDownBrowser(): void {
  if (Platform.OS !== 'web') {
    WebBrowser.coolDownAsync().catch(() => {});
  }
}
