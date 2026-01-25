// app/(tabs)/history.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Share,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  loadHistory,
  clearHistory,
  type Badge,
  type ScanHistoryItem,
} from "../../utils/historyStore";

function badgeLabel(b: Badge) {
  if (b === "VERIFIED") return "✅";
  if (b === "UNVERIFIED") return "⚠️";
  return "❌";
}

function clampScore(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export default function HistoryScreen() {
  const router = useRouter();

  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | Badge>("ALL");

  // Reload history every time user opens this tab (so it always shows latest scans)
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
        const hay = `${it.domain} ${it.title ?? ""} ${it.badge} ${it.score}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [items, q, filter]);

  const onOpen = (it: ScanHistoryItem) => {
    // Pass full payload to Result screen
    const payload = encodeURIComponent(JSON.stringify(it));
    router.push(`/result?payload=${payload}`);
  };

  const onShare = async (it: ScanHistoryItem) => {
    const msg = [
      "REAiL Scan Result",
      `${badgeLabel(it.badge)} ${it.badge} • Score: ${clampScore(it.score)}/100`,
      `Domain: ${it.domain}`,
      it.title ? `Title: ${it.title}` : "",
      it.url ? `Link: ${it.url}` : "",
      "",
      "Risk-based verification • Not absolute truth",
    ]
      .filter(Boolean)
      .join("\n");

    await Share.share({ message: msg });
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

  const FilterBtn = ({
    label,
    value,
  }: {
    label: string;
    value: "ALL" | Badge;
  }) => (
    <Pressable
      onPress={() => setFilter(value)}
      style={[
        styles.filterBtn,
        filter === value && styles.filterBtnActive,
      ]}
    >
      <Text style={styles.filterText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0c10" }}>
      <View style={styles.topBar}>
        <Text style={styles.title}>History</Text>
        <Pressable onPress={onClear} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Clear</Text>
        </Pressable>
      </View>

      <View style={{ padding: 16 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search scans…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={{ height: 10 }} />

        <View style={styles.filtersRow}>
          <FilterBtn label="All" value="ALL" />
          <FilterBtn label="✅" value="VERIFIED" />
          <FilterBtn label="⚠️" value="UNVERIFIED" />
          <FilterBtn label="❌" value="HIGH_RISK" />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it, idx) => `${it.scanId ?? it.createdAt}-${idx}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ paddingTop: 30 }}>
            <Text style={{ color: "white", opacity: 0.7, textAlign: "center" }}>
              No scans yet.
            </Text>
            <Text style={{ color: "white", opacity: 0.5, textAlign: "center", marginTop: 6 }}>
              Scan a link or screenshot to build your history.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable onPress={() => onOpen(item)} style={{ flex: 1 }}>
              <Text style={styles.cardTop}>
                {badgeLabel(item.badge)}{" "}
                <Text style={{ fontWeight: "900" }}>{item.domain}</Text>
              </Text>
              <Text style={styles.cardSub}>
                Score: {clampScore(item.score)}/100 • {new Date(item.createdAt).toLocaleString()}
              </Text>
              {!!item.title && (
                <Text style={styles.cardSub2} numberOfLines={1}>
                  {item.title}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => onShare(item)} style={styles.shareBtn}>
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles: any = {
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  title: { color: "white", fontWeight: "900", fontSize: 16 },
  topBtn: {
    minWidth: 60,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnText: { color: "white", opacity: 0.85, fontWeight: "800" },

  search: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  filtersRow: { flexDirection: "row", gap: 8 },
  filterBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "rgba(120,180,255,0.18)",
    borderColor: "rgba(120,180,255,0.35)",
  },
  filterText: { color: "white", opacity: 0.9, fontWeight: "800" },

  card: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
  },
  cardTop: { color: "white", fontSize: 13, opacity: 0.95 },
  cardSub: { color: "white", opacity: 0.65, marginTop: 4, fontSize: 12 },
  cardSub2: { color: "white", opacity: 0.75, marginTop: 6, fontSize: 12 },

  shareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  shareText: { color: "white", fontWeight: "900", opacity: 0.9 },
};
