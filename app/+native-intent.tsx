function extractUrlFromText(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  return urlMatch ? urlMatch[0] : null;
}

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[NativeIntent] Received path:', path, 'initial:', initial);
  
  if (!path || path === '/') {
    return '/';
  }

  if (path.includes('/result/')) {
    const scanId = path.split('/result/')[1]?.split('?')[0];
    if (scanId) {
      console.log('[NativeIntent] Redirecting to result with scanId:', scanId);
      return `/result?scanId=${encodeURIComponent(scanId)}`;
    }
  }

  if (path.includes('scanId=')) {
    const match = path.match(/scanId=([^&]+)/);
    if (match?.[1]) {
      console.log('[NativeIntent] Redirecting to result with scanId:', match[1]);
      return `/result?scanId=${encodeURIComponent(match[1])}`;
    }
  }

  const extractedUrl = extractUrlFromText(path);
  if (extractedUrl) {
    console.log('[NativeIntent] Share-to-Scan detected, URL:', extractedUrl);
    return `/scanning?url=${encodeURIComponent(extractedUrl)}`;
  }

  return '/';
}