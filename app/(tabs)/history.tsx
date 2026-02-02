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
import { Search, Trash2, Share2, Clock } from "lucide-react-native";
import {
  loadHistory,
  clearHistory,
  type Badge,
  type ScanHistoryItem,
} from "../../utils/historyStore";
import BadgePill, { getBadgeLabel } from "@/components/ui/BadgePill";
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

  const onOpen = (it: ScanHistoryItem) => {
    const payload = encodeURIComponent(JSON.stringify(it));
    router.push(`/result?payload=${payload}`);
  };

  const onShare = async (it: ScanHistoryItem) => {
    const msg = [
      "REAiL Scan Result",
      `${getBadgeLabel(it.badge)} • Score: ${clampScore(it.score)}/100`,
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

  const filterOptions: { label: string; value: FilterValue; badge?: Badge }[] = [
    { label: "All", value: "ALL" },
    { label: "Verified", value: "VERIFIED", badge: "VERIFIED" },
    { label: "Unverified", value: "UNVERIFIED", badge: "UNVERIFIED" },
    { label: "High Risk", value: "HIGH_RISK", badge: "HIGH_RISK" },
  ];

  const renderItem = ({ item }: { item: ScanHistoryItem }) => (
    <Pressable 
      onPress={() => onOpen(item)} 
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <BadgePill badge={item.badge} size="small" />
          <Text style={styles.cardDomain} numberOfLines={1}>{item.domain}</Text>
        </View>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardScore}>Score: {clampScore(item.score)}/100</Text>
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

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>History</Text>
        <Pressable 
          onPress={onClear} 
          style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
        >
          <Trash2 size={18} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={styles.topBtnText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.contentPadding}>
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search scans by domain, title, URL..."
            placeholderTextColor={Colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.filtersRow}>
          {filterOptions.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setFilter(opt.value)}
              style={[
                styles.filterChip,
                filter === opt.value && styles.filterChipActive,
              ]}
            >
              {opt.badge ? (
                <BadgePill badge={opt.badge} size="small" showLabel={false} />
              ) : null}
              <Text style={[
                styles.filterText,
                filter === opt.value && styles.filterTextActive,
              ]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hintText}>Tap item to open full report</Text>
      </View>

      <FlatList
        data={groupedData}
        keyExtractor={(group) => group.title}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Clock size={48} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptySub}>
              Scan a link to build your history.
            </Text>
          </View>
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
  title: {
    color: Colors.text,
    fontWeight: "800" as const,
    fontSize: 18,
  },
  topBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
  },
  topBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  topBtnText: {
    color: Colors.textSecondary,
    fontWeight: "700" as const,
    fontSize: 13,
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
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  filterChipActive: {
    backgroundColor: `${Colors.primary}20`,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  filterTextActive: {
    color: Colors.primary,
  },
  hintText: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 12,
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
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: 10,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  cardContent: {
    flex: 1,
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
    color: Colors.textSecondary,
    fontSize: 12,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnPressed: {
    backgroundColor: Colors.cardHighlight,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
  },
  emptyTitle: {
    color: Colors.text,
    opacity: 0.7,
    textAlign: "center" as const,
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  emptySub: {
    color: Colors.textTertiary,
    textAlign: "center" as const,
    marginTop: 6,
    fontSize: 13,
  },
});
