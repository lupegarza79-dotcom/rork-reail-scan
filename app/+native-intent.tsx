import { router } from 'expo-router';

function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[NativeIntent] Received path:', path, 'initial:', initial);
  
  if (!path || path === '/') {
    return '/';
  }

  const extractedUrl = extractUrlFromText(path);
  
  if (extractedUrl) {
    console.log('[NativeIntent] Share-to-Scan detected, URL:', extractedUrl);
    
    setTimeout(() => {
      router.push({ pathname: '/scanning', params: { url: extractedUrl } });
    }, 100);
    
    return '/';
  }

  if (path.includes('result/') || path.includes('scan/')) {
    const scanIdMatch = path.match(/(?:result|scan)\/([^/?]+)/);
    if (scanIdMatch) {
      const scanId = scanIdMatch[1];
      console.log('[NativeIntent] Deep link to result, scanId:', scanId);
      
      setTimeout(() => {
        router.push({ pathname: '/result', params: { scanId } });
      }, 100);
      
      return '/';
    }
  }

  return path;
}
