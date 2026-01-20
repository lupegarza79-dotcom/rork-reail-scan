function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
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
}: { path: string; initial: boolean }) {
  console.log('[NativeIntent] Received path:', path, 'initial:', initial);
  
  if (!path || path === '/') {
    return '/';
  }

  const scanId = extractScanIdFromPath(path);
  if (scanId) {
    console.log('[NativeIntent] Routing to result with scanId:', scanId);
    return `/result?scanId=${encodeURIComponent(scanId)}`;
  }

  const sharedUrl = extractUrlFromText(path);
  if (sharedUrl) {
    console.log('[NativeIntent] Share-to-Scan detected, routing with URL:', sharedUrl);
    return `/scanning?url=${encodeURIComponent(sharedUrl)}`;
  }

  return '/';
}