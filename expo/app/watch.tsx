import React, { useCallback } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, Trash2, Activity, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors, { Fonts } from '@/constants/colors';
import { useAppState, WatchItem, Verdict } from '@/providers/AppState';

const VERDICT_COLOR: Record<Verdict, string> = {
  STOP: Colors.highRisk,
  CAUTION: Colors.unverified,
  OK: Colors.verified,
};
const VERDICT_LABEL: Record<Verdict, string> = {
  STOP: 'HIGH RISK',
  CAUTION: 'REVIEW',
  OK: 'VERIFIED',
};

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WatchScreen() {
  const router = useRouter();
  const { watch, removeFromWatch } = useAppState();

  const renderItem = useCallback(
    ({ item }: { item: WatchItem }) => {
      const color = VERDICT_COLOR[item.verdict];
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push(`/s/${item.token}` as never)}
          activeOpacity={0.7}
          testID={`watch-row-${item.token}`}
        >
          <View style={[styles.rowDot, { backgroundColor: color }]} />
          <View style={styles.rowBody}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowDomain} numberOfLines={1}>
                {item.domain}
              </Text>
              <View style={styles.liveBadge}>
                <Activity size={9} color={Colors.verified} strokeWidth={2.5} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.rowMeta}>
              <Text style={[styles.rowVerdict, { color }]}>{VERDICT_LABEL[item.verdict]}</Text>
              <Text style={styles.rowDot2}>·</Text>
              <Text style={styles.rowScore}>score {item.score}</Text>
              <Text style={styles.rowDot2}>·</Text>
              <Text style={styles.rowTime}>{timeAgo(item.addedAt)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              removeFromWatch(item.token);
            }}
            style={styles.removeBtn}
            testID={`watch-remove-${item.token}`}
            hitSlop={10}
          >
            <Trash2 size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
          <ChevronRight size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      );
    },
    [router, removeFromWatch]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.topNavBtn}
            onPress={() => router.back()}
            testID="watch-back"
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color={Colors.text} />
            <Text style={styles.topNavBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Eye size={14} color={Colors.text} />
            <Text style={styles.title}>Watch</Text>
          </View>
          <View style={{ width: 56 }} />
        </View>

        {watch.length === 0 ? (
          <View style={styles.empty}>
            <Eye size={36} color={Colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Nothing watched yet</Text>
            <Text style={styles.emptySub}>
              Open a scan and tap Watch to monitor it for changes.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.replace('/')}
              activeOpacity={0.85}
              testID="watch-go-scan"
            >
              <Text style={styles.ctaText}>Run a scan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={watch}
            keyExtractor={(it) => it.token}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
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
  topNav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topNavBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topNavBtnText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: Colors.text,
  },
  titleWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
  },
  empty: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
    marginTop: 4,
  },
  emptySub: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  cta: {
    marginTop: 16,
    backgroundColor: Colors.text,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ctaText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: '#09090B',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sep: {
    height: 8,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  rowDomain: {
    flex: 1,
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.text,
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.verifiedBg,
    borderColor: Colors.verified,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.verified,
  },
  rowMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  rowVerdict: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  rowScore: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  rowTime: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  rowDot2: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  removeBtn: {
    padding: 6,
  },
});
