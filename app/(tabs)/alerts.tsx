import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Share,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import {
  ReailAlert,
  loadAlerts,
  markAlertRead,
  markAllRead,
  clearAlerts,
  addWatch,
  seedDemoAlertsIfEmpty,
} from "../../utils/alertsStore";
import {
  fetchAlerts,
  markAlertReadApi,
  markAllAlertsReadApi,
} from "../../utils/api";
import Colors from "@/constants/colors";

function badgeEmoji(b: ReailAlert["badge"]) {
  if (b === "VERIFIED") return "✅";
  if (b === "UNVERIFIED") return "⚠️";
  return "❌";
}

export default function AlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<ReailAlert[]>([]);
  const [q, setQ] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // Try backend first
        const remote = await fetchAlerts();
        if (!active) return;

        if (remote?.items?.length) {
          const mapped: ReailAlert[] = remote.items.map((x: any) => ({
            id: x.id,
            createdAt: x.created_at,
            entityType: x.entity_type,
            entityKey: x.entity_key,
            scanId: x.scan_id,
            badge: x.badge,
            score: x.score,
            message: x.message,
            topReasons: x.top_reasons || [],
            readAt: x.read_at,
          }));
          setAlerts(mapped);
          return;
        }

        // Fallback to local demo
        const seeded = await seedDemoAlertsIfEmpty();
        const arr = seeded?.length ? seeded : await loadAlerts();
        if (active) setAlerts(arr);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = alerts.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (!query) return list;
    return list.filter((a) => {
      const hay = `${a.entityType} ${a.entityKey} ${a.badge} ${a.score} ${a.message}`.toLowerCase();
      return hay.includes(query);
    });
  }, [alerts, q]);

  const onOpen = async (a: ReailAlert) => {
    // Try backend first, fallback to local
    await markAlertReadApi(a.id);
    const merged = await markAlertRead(a.id);
    setAlerts(merged);

    if (a.scanId) {
      router.push(`/result?scanId=${encodeURIComponent(a.scanId)}`);
      return;
    }

    const payload = encodeURIComponent(
      JSON.stringify({
        badge: a.badge,
        score: a.score,
        domain: a.entityKey,
        title: a.message,
        reasons: undefined,
        timestamp: Date.now(),
      })
    );
    router.push(`/result?payload=${payload}`);
  };

  const onShare = async (a: ReailAlert) => {
    const msg = [
      "REAiL Alert",
      `${badgeEmoji(a.badge)} ${a.badge} • Score: ${a.score}/100`,
      `Entity: ${a.entityType} • ${a.entityKey}`,
      a.message,
      "",
      "Risk-based verification • Not absolute truth",
    ].join("\n");
    await Share.share({ message: msg });
  };

  const onWatch = async (a: ReailAlert) => {
    await addWatch(a.entityType, a.entityKey);
    Alert.alert("Watch added", `${a.entityKey} added to your watchlist.`);
  };

  const onMarkAllRead = async () => {
    // Try backend first, fallback to local
    await markAllAlertsReadApi();
    const merged = await markAllRead();
    setAlerts(merged);
  };

  const onClear = async () => {
    Alert.alert("Clear alerts?", "This will delete all alerts on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearAlerts();
          setAlerts([]);
        },
      },
    ]);
  };

  const unreadCount = useMemo(() => alerts.filter((a) => !a.readAt).length, [alerts]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Alerts</Text>
        <View style={styles.topActions}>
          <Pressable onPress={onMarkAllRead} style={styles.topBtn}>
            <Text style={styles.topBtnText}>Mark read</Text>
          </Pressable>
          <Pressable onPress={onClear} style={styles.topBtn}>
            <Text style={styles.topBtnText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.contentPadding}>
        <View style={styles.rowInfo}>
          <Text style={styles.infoText}>
            Unread: <Text style={styles.infoCount}>{unreadCount}</Text>
          </Text>
          <Pressable onPress={() => router.push("/watchlist")} style={styles.watchBtn}>
            <Text style={styles.watchText}>Watchlist</Text>
          </Pressable>
        </View>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search alerts…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptySub}>
              Watch a domain or vendor to get notified when risk changes.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.readAt && styles.cardUnread]}>
            <Pressable onPress={() => onOpen(item)} style={styles.cardContent}>
              <Text style={styles.cardTop}>
                {badgeEmoji(item.badge)}{" "}
                <Text style={styles.cardEntity}>{item.entityKey}</Text>{" "}
                <Text style={styles.cardType}>({item.entityType})</Text>
              </Text>
              <Text style={styles.cardSub}>
                Score: {item.score}/100 • {new Date(item.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.cardMsg} numberOfLines={2}>
                {item.message}
              </Text>

              {!!item.topReasons?.length && (
                <View style={styles.reasonsContainer}>
                  {item.topReasons.slice(0, 2).map((r, idx) => (
                    <Text key={idx} style={styles.reasonLine}>
                      {r.key}) {r.summary}
                    </Text>
                  ))}
                </View>
              )}
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable onPress={() => onShare(item)} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Share</Text>
              </Pressable>
              <Pressable onPress={() => onWatch(item)} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Watch</Text>
              </Pressable>
            </View>
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
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  title: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  topBtn: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnText: {
    color: "white",
    opacity: 0.85,
    fontWeight: "800",
  },
  contentPadding: {
    padding: 16,
  },
  rowInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoText: {
    color: "white",
    opacity: 0.8,
  },
  infoCount: {
    fontWeight: "900",
  },
  watchBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
  },
  watchText: {
    color: "white",
    fontWeight: "900",
    opacity: 0.9,
  },
  search: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
  },
  emptyTitle: {
    color: "white",
    opacity: 0.7,
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  emptySub: {
    color: "white",
    opacity: 0.5,
    textAlign: "center",
    marginTop: 6,
  },
  card: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: "rgba(120,180,255,0.30)",
    backgroundColor: "rgba(120,180,255,0.08)",
  },
  cardContent: {
    flex: 1,
  },
  cardTop: {
    color: "white",
    fontSize: 13,
    opacity: 0.95,
  },
  cardEntity: {
    fontWeight: "900",
  },
  cardType: {
    opacity: 0.7,
  },
  cardSub: {
    color: "white",
    opacity: 0.65,
    marginTop: 4,
    fontSize: 12,
  },
  cardMsg: {
    color: "white",
    opacity: 0.82,
    marginTop: 6,
    fontSize: 12,
  },
  reasonsContainer: {
    marginTop: 8,
  },
  reasonLine: {
    color: "white",
    opacity: 0.7,
    fontSize: 12,
    marginTop: 4,
  },
  cardActions: {
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  smallBtnText: {
    color: "white",
    fontWeight: "900",
    opacity: 0.9,
  },
});
