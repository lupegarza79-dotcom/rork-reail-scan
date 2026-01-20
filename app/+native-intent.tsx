import { router } from 'expo-router';

function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

function extractScanIdFromPath(path: string): string | null {
  const resultMatch = path.match(/\/result\/([a-zA-Z0-9_-]+)/);
  if (resultMatch) return resultMatch[1];
  
  const scanMatch = path.match(/\/scan\/([a-zA-Z0-9_-]+)/);
  if (scanMatch) return scanMatch[1];
  
  const queryMatch = path.match(/[?&]scanId=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];
  
  return null;
}

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }): string {
  console.log('[NativeIntent] Received path:', path, 'initial:', initial);
  
  if (!path || path === '/') {
    return '/';
  }

  const scanId = extractScanIdFromPath(path);
  if (scanId) {
    console.log('[NativeIntent] Found scanId, redirecting to result:', scanId);
    setTimeout(() => {
      router.push({ pathname: '/result', params: { scanId } });
    }, 100);
    return '/';
  }

  const sharedUrl = extractUrlFromText(path);
  if (sharedUrl) {
    console.log('[NativeIntent] Share-to-Scan detected, URL:', sharedUrl);
    setTimeout(() => {
      router.push({ pathname: '/scanning', params: { url: sharedUrl } });
    }, 100);
    return '/';
  }

  console.log('[NativeIntent] No special handling, returning to home');
  return '/';
}
