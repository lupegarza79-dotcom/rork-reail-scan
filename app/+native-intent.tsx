function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/gi;
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

  const decodedPath = decodeURIComponent(path);
  console.log('[NativeIntent] Decoded path:', decodedPath);

  if (decodedPath.includes('/result/')) {
    const scanIdMatch = decodedPath.match(/\/result\/([a-zA-Z0-9_-]+)/);
    if (scanIdMatch) {
      const scanId = scanIdMatch[1];
      console.log('[NativeIntent] Result deep link detected, scanId:', scanId);
      return `/result?scanId=${scanId}`;
    }
  }

  const sharedUrl = extractUrlFromText(decodedPath);
  if (sharedUrl) {
    console.log('[NativeIntent] Share-to-Scan detected, URL:', sharedUrl);
    return `/scanning?url=${encodeURIComponent(sharedUrl)}`;
  }

  if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) {
    console.log('[NativeIntent] Direct URL shared:', decodedPath);
    return `/scanning?url=${encodeURIComponent(decodedPath)}`;
  }

  console.log('[NativeIntent] No actionable path found, returning home');
  return '/';
}