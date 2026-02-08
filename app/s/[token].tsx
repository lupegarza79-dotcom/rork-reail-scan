import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Share, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle, Share2, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Logo from '@/components/Logo';
import { resolveShareLink, WalletShareData } from '@/utils/walletShare';
import type { BadgeType } from '@/types/scan';

const BADGE_CONFIG: Record<BadgeType | 'UNKNOWN', { 
  color: string; 
  bg: string; 
  label: string; 
  Icon: typeof Shield;
}> = {
  VERIFIED: {
    color: Colors.verified,
    bg: Colors.verifiedBg,
    label: 'Verified Safe',
    Icon: ShieldCheck,
  },
  UNVERIFIED: {
    color: Colors.unverified,
    bg: Colors.unverifiedBg,
    label: 'Unverified',
    Icon: ShieldQuestion,
  },
  HIGH_RISK: {
    color: Colors.highRisk,
    bg: Colors.highRiskBg,
    label: 'High Risk',
    Icon: ShieldAlert,
  },
  UNKNOWN: {
    color: Colors.textSecondary,
    bg: Colors.backgroundTertiary,
    label: 'Not Scanned',
    Icon: Shield,
  },
};

export default function ShareLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery<WalletShareData | null>({
    queryKey: ['share-link', token],
    queryFn: () => resolveShareLink(token || ''),
    enabled: !!token,
    staleTime: 30000,
  });

  const badgeKey = useMemo(() => {
    if (!data?.badge) return 'UNKNOWN';
    return data.badge as BadgeType;
  }, [data?.badge]);

  const config = BADGE_CONFIG[badgeKey] || BADGE_CONFIG.UNKNOWN;
  const BadgeIcon = config.Icon;

  const handleShare = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const shareUrl = Platform.OS === 'web' 
      ? window.location.href 
      : `https://reail.app/s/${token}`;
    
    const message = data?.badge === 'HIGH_RISK'
      ? `Warning! This link has been flagged as HIGH RISK by REAiL Scan. Check the report: ${shareUrl}`
      : data?.badge === 'VERIFIED'
      ? `This link has been verified as safe by REAiL Scan: ${shareUrl}`
      : `Check this link's safety report on REAiL Scan: ${shareUrl}`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: 'REAiL Safety Report', text: message, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
        }
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      console.log('[ShareLink] Share error:', err);
    }
  }, [token, data]);

  const handleFullScan = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (data?.original_url) {
      router.push({ pathname: '/scanning', params: { url: data.original_url } });
    }
  }, [data?.original_url, router]);

  const handleOpenLink = useCallback(() => {
    if (data?.original_url) {
      Linking.openURL(data.original_url);
    }
  }, [data?.original_url]);

  useEffect(() => {
    if (Platform.OS === 'web' && data) {
      const badgeText = data.badge || 'UNSCANNED';
      document.title = `${badgeText} - REAiL Safety Report`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            headerShown: false,
            title: 'REAiL Safety Report',
          }} 
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Logo size="small" />
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
            <Text style={styles.loadingText}>Loading safety report...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Logo size="small" />
            <ShieldAlert size={64} color={Colors.highRisk} style={styles.errorIcon} />
            <Text style={styles.errorTitle}>Link Not Found</Text>
            <Text style={styles.errorText}>
              This share link may have expired or does not exist.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <RefreshCw size={18} color={Colors.text} />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/')}>
              <Text style={styles.homeText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: `${data.badge || 'Safety'} Report - REAiL`,
        }} 
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Logo size="small" />
          <Text style={styles.headerSubtitle}>Safety Report</Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.badgeCard, { borderColor: config.color }]}>
            <View style={[styles.badgeIconContainer, { backgroundColor: config.bg }]}>
              <BadgeIcon size={48} color={config.color} />
            </View>
            <Text style={[styles.badgeLabel, { color: config.color }]}>{config.label}</Text>
            {data.score !== null && (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Trust Score</Text>
                <Text style={[styles.scoreValue, { color: config.color }]}>{data.score}/100</Text>
              </View>
            )}
          </View>

          <View style={styles.urlCard}>
            <Text style={styles.urlLabel}>Scanned Link</Text>
            <Text style={styles.urlDomain} numberOfLines={1}>{data.domain}</Text>
            <Text style={styles.urlFull} numberOfLines={2}>{data.original_url}</Text>
          </View>

          {data.top_red_flags && data.top_red_flags.length > 0 && (
            <View style={styles.flagsCard}>
              <Text style={styles.flagsTitle}>Red Flags Detected</Text>
              {data.top_red_flags.map((flag, idx) => (
                <View key={idx} style={styles.flagRow}>
                  <AlertTriangle size={16} color={Colors.unverified} />
                  <Text style={styles.flagText}>{flag}</Text>
                </View>
              ))}
            </View>
          )}

          {data.next_action && (
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Recommended Action</Text>
              <Text style={styles.actionText}>{data.next_action}</Text>
            </View>
          )}

          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: Colors.primary }]} 
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Share2 size={20} color={Colors.text} />
              <Text style={styles.primaryButtonText}>Share This Report</Text>
            </TouchableOpacity>

            {!data.badge && (
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={handleFullScan}
                activeOpacity={0.85}
              >
                <Shield size={18} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Run Full Scan</Text>
                <ArrowRight size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}

            {data.badge === 'VERIFIED' && (
              <TouchableOpacity 
                style={styles.linkButton} 
                onPress={handleOpenLink}
                activeOpacity={0.7}
              >
                <ExternalLink size={16} color={Colors.textSecondary} />
                <Text style={styles.linkButtonText}>Open Original Link</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Scanned {data.view_count ? `${data.view_count} times` : 'recently'}
            </Text>
            <Text style={styles.footerPowered}>Powered by REAiL Systems</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginTop: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    marginTop: 32,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  homeButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  homeText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  badgeCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeLabel: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  urlCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  urlLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlDomain: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  urlFull: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  flagsCard: {
    backgroundColor: Colors.unverifiedBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.unverified,
    padding: 16,
    marginBottom: 16,
  },
  flagsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.unverified,
    marginBottom: 12,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  flagText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 24,
  },
  actionTitle: {
    fontSize: 12,
    color: Colors.accent,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600' as const,
  },
  actionText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  buttonsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  linkButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  footerPowered: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
