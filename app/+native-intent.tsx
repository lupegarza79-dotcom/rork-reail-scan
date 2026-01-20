import { router } from 'expo-router';

function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}

function extractScanIdFromPath(path: string): string | null {
  const resultMatch = path.match(/result\/([a-zA-Z0-9_-]+)/);
  if (resultMatch) return resultMatch[1];
  
  const scanMatch = path.match(/scan\/([a-zA-Z0-9_-]+)/);
  if (scanMatch) return scanMatch[1];
  
  return null;
}

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[NativeIntent] Received path:', path, 'initial:', initial);
  
  const scanId = extractScanIdFromPath(path);
  if (scanId) {
    console.log('[NativeIntent] Found scanId:', scanId);
    return `/result?scanId=${scanId}`;
  }
  
  const extractedUrl = extractUrlFromText(path);
  if (extractedUrl) {
    console.log('[NativeIntent] Extracted URL for scan:', extractedUrl);
    return `/scanning?url=${encodeURIComponent(extractedUrl)}`;
  }
  
  if (path.includes('http://') || path.includes('https://')) {
    const urlMatch = path.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      console.log('[NativeIntent] Found URL in path:', urlMatch[1]);
      return `/scanning?url=${encodeURIComponent(urlMatch[1])}`;
    }
  }
  
  console.log('[NativeIntent] No actionable content, going to home');
  return '/';
}
