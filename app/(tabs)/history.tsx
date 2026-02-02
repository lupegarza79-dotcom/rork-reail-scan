import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Share,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter, useFocusEffect } from "expo-router";
import { Search, Trash2, Share2, Clock, History, ChevronRight, RefreshCw } from "lucide-react-native";
import {
  loadHistory,
  clearHistory,
  type Badge,
  type ScanHistoryItem,
} from "../../utils/historyStore";
import BadgePill, { getBadgeLabel, getBadgeColor } from "@/components/ui/BadgePill";
import Colors from "@/constants/colors";

function clampScore(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return "Today";
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return "Yesterday";
  
  return "Older";
}

type FilterValue = "ALL" | Badge;

export default function HistoryScreen() {
  const router = useRouter();

  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterValue>("ALL");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const history = await loadHistory();
        if (active) setItems(history);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((it) => (filter === "ALL" ? true : it.badge === filter))
      .filter((it) => {
        if (!query) return true;
        const hay = `${it.domain} ${it.title ?? ""} ${it.badge} ${it.score} ${it.url ?? ""}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [items, q, filter]);

  const groupedData = useMemo(() => {
    const groups: { title: string; data: ScanHistoryItem[] }[] = [];
    const groupMap: Record<string, ScanHistoryItem[]> = {};
    
    filtered.forEach((item) => {
      const group = getDateGroup(item.createdAt);
      if (!groupMap[group]) {
        groupMap[group] = [];
      }
      groupMap[group].push(item);
    });
    
    const order = ["Today", "Yesterday", "Older"];
    order.forEach((g) => {
      if (groupMap[g]?.length) {
        groups.push({ title: g, data: groupMap[g] });
      }
    });
    
    return groups;
  }, [filtered]);

  const stats = useMemo(() => {
    const verified = items.filter(i => i.badge === "VERIFIED").length;
    const unverified = items.filter(i => i.badge === "UNVERIFIED").length;
    const highRisk = items.filter(i => i.badge === "HIGH_RISK").length;
    return { verified, unverified, highRisk, total: items.length };
  }, [items]);

  const onOpen = (it: ScanHistoryItem) => {
    const payload = encodeURIComponent(JSON.stringify(it));
    router.push(`/result?payload=${payload}`);
  };

  const onShare = async (it: ScanHistoryItem) => {
    const msg = [
      "REAiL Scan Result",
      `${getBadgeLabel(it.badge)} • Risk Score: ${clampScore(it.score)}/100`,
      `Domain: ${it.domain}`,
      it.title ? `Title: ${it.title}` : "",
      it.url ? `Link: ${it.url}` : "",
      "",
      "Risk-based verification • Not absolute truth",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await Share.share({ message: msg });
    } catch {
      try {
        await Clipboard.setStringAsync(msg);
        if (Platform.OS === "web") {
          alert("Scan copied to clipboard!");
        } else {
          Alert.alert("Copied", "Scan copied to clipboard.");
        }
      } catch {
        console.log("[Share] Failed to copy");
      }
    }
  };

  const onClear = () => {
    Alert.alert("Clear history?", "This will delete all saved scans.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearHistory();
          setItems([]);
        },
      },
    ]);
  };

  const filterOptions: { label: string; value: FilterValue; badge?: Badge; count: number }[] = [
    { label: "All", value: "ALL", count: stats.total },
    { label: "Verified", value: "VERIFIED", badge: "VERIFIED", count: stats.verified },
    { label: "Unverified", value: "UNVERIFIED", badge: "UNVERIFIED", count: stats.unverified },
    { label: "High Risk", value: "HIGH_RISK", badge: "HIGH_RISK", count: stats.highRisk },
  ];

  const renderItem = ({ item }: { item: ScanHistoryItem }) => {
    const badgeColor = getBadgeColor(item.badge);
    return (
      <Pressable 
        onPress={() => onOpen(item)} 
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.cardAccent, { backgroundColor: badgeColor }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <BadgePill badge={item.badge} size="small" />
            <Text style={styles.cardDomain} numberOfLines={1}>{item.domain}</Text>
            <ChevronRight size={16} color={Colors.textTertiary} strokeWidth={2} />
          </View>
          <View style={styles.cardMetaRow}>
            <Text style={[styles.cardScore, { color: badgeColor }]}>
              {clampScore(item.score)}/100
            </Text>
            <View style={styles.cardTimestamp}>
              <Clock size={12} color={Colors.textTertiary} strokeWidth={2} />
              <Text style={styles.cardTime}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
          {!!item.title && (
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
          )}
        </View>

        <Pressable 
          onPress={() => onShare(item)} 
          style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
        >
          <Share2 size={16} color={Colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </Pressable>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <History size={20} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.title}>History</Text>
          {stats.total > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{stats.total}</Text>
            </View>
          )}
        </View>
        <Pressable 
          onPress={onClear} 
          style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
        >
          <Trash2 size={18} color={Colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.contentPadding}>
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by domain, title, URL..."
            placeholderTextColor={Colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.filtersRow}>
          {filterOptions.map((opt) => {
            const isActive = filter === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setFilter(opt.value)}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  opt.badge && isActive && { borderColor: getBadgeColor(opt.badge) },
                ]}
              >
                {opt.badge ? (
                  <BadgePill badge={opt.badge} size="small" showLabel={false} />
                ) : null}
                <Text style={[
                  styles.filterText,
                  isActive && styles.filterTextActive,
                  opt.badge && isActive && { color: getBadgeColor(opt.badge) },
                ]}>
                  {opt.label}
                </Text>
                {opt.count > 0 && (
                  <Text style={[
                    styles.filterCount,
                    isActive && styles.filterCountActive,
                  ]}>
                    {opt.count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={groupedData}
        keyExtractor={(group) => group.title}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <RefreshCw size={48} color={Colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptySub}>
              Try your first link to build your history.{"\n"}
              Your scan results will appear here.
            </Text>
            <Pressable 
              onPress={() => router.push("/")}
              style={({ pressed }) => [styles.emptyBtn, pressed && styles.emptyBtnPressed]}
            >
              <Text style={styles.emptyBtnText}>Scan a Link</Text>
            </Pressable>
          </View>
        }
        ListHeaderComponent={
          filtered.length > 0 ? (
            <Text style={styles.hintText}>Tap any item to view full report</Text>
          ) : null
        }
        renderItem={({ item: group }) => (
          <View>
            {renderSectionHeader(group.title)}
            {group.data.map((scanItem, idx) => (
              <View key={`${scanItem.scanId ?? scanItem.createdAt}-${idx}`}>
                {renderItem({ item: scanItem })}
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: Colors.text,
    fontWeight: "800" as const,
    fontSize: 18,
  },
  countBadge: {
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "700" as const,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundSecondary,
  },
  topBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  contentPadding: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  filterChipActive: {
    backgroundColor: `${Colors.primary}15`,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    fontSize: 12,
  },
  filterTextActive: {
    color: Colors.primary,
  },
  filterCount: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: "600" as const,
  },
  filterCountActive: {
    color: Colors.primary,
  },
  hintText: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginBottom: 8,
    textAlign: "center" as const,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingVertical: 10,
    marginTop: 8,
  },
  sectionHeaderText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  cardPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  cardDomain: {
    flex: 1,
    color: Colors.text,
    fontWeight: "700" as const,
    fontSize: 14,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardScore: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  cardTimestamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardTime: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  cardTitle: {
    color: Colors.textTertiary,
    fontSize: 12,
    marginTop: 6,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundTertiary,
    marginRight: 10,
  },
  shareBtnPressed: {
    backgroundColor: Colors.cardHighlight,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    color: Colors.text,
    textAlign: "center" as const,
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  emptySub: {
    color: Colors.textTertiary,
    textAlign: "center" as const,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  emptyBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  emptyBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700" as const,
  },
});
