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
  Platform,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { 
  Bell, 
  Eye, 
  Share2, 
  Search, 
  CheckCheck, 
  Trash2,
  X,
  Plus,
} from "lucide-react-native";
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
import BadgePill, { getBadgeLabel } from "@/components/ui/BadgePill";
import Colors from "@/constants/colors";

export default function AlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<ReailAlert[]>([]);
  const [q, setQ] = useState("");
  const [watchModalOpen, setWatchModalOpen] = useState(false);
  const [watchInput, setWatchInput] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const remote = await fetchAlerts();
        if (!active) return;

        if (remote?.items?.length) {
          const mapped: ReailAlert[] = remote.items.map((x: Record<string, unknown>) => ({
            id: x.id as string,
            createdAt: typeof x.created_at === 'number' 
              ? new Date(x.created_at).toISOString() 
              : (x.created_at as string),
            entityType: x.entity_type as "domain" | "vendor" | "creator" | "link",
            entityKey: x.entity_key as string,
            scanId: x.scan_id as string,
            badge: x.badge as ReailAlert["badge"],
            score: x.score as number,
            message: x.message as string,
            topReasons: (x.top_reasons as ReailAlert["topReasons"]) || [],
            readAt: x.read_at ? (typeof x.read_at === 'number' 
              ? new Date(x.read_at).toISOString() 
              : (x.read_at as string)) : undefined,
          }));
          setAlerts(mapped);
          return;
        }

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
      `${getBadgeLabel(a.badge)} • Score: ${a.score}/100`,
      `Entity: ${a.entityType} • ${a.entityKey}`,
      a.message,
      "",
      "Risk-based verification • Not absolute truth",
    ].join("\n");
    
    try {
      await Share.share({ message: msg });
    } catch {
      try {
        await Clipboard.setStringAsync(msg);
        if (Platform.OS === "web") {
          alert("Alert copied to clipboard!");
        } else {
          Alert.alert("Copied", "Alert copied to clipboard.");
        }
      } catch {
        console.log("[Share] Failed to copy");
      }
    }
  };

  const onWatch = async (a: ReailAlert) => {
    await addWatch(a.entityType as "domain" | "vendor" | "creator" | "link", a.entityKey);
    Alert.alert("Watch added", `${a.entityKey} added to your watchlist.`);
  };

  const onMarkAllRead = async () => {
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

  const onAddWatch = async () => {
    const trimmed = watchInput.trim();
    if (!trimmed) return;
    await addWatch("domain", trimmed);
    Alert.alert("Added", `${trimmed} added to watchlist.`);
    setWatchInput("");
    setWatchModalOpen(false);
  };

  const unreadCount = useMemo(() => alerts.filter((a) => !a.readAt).length, [alerts]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.topActions}>
          <Pressable 
            onPress={onMarkAllRead} 
            style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
          >
            <CheckCheck size={16} color={Colors.textSecondary} strokeWidth={2} />
          </Pressable>
          <Pressable 
            onPress={onClear} 
            style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
          >
            <Trash2 size={16} color={Colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <View style={styles.contentPadding}>
        <View style={styles.watchlistRow}>
          <Pressable 
            onPress={() => router.push("/watchlist")} 
            style={({ pressed }) => [styles.watchlistBtn, pressed && styles.watchlistBtnPressed]}
          >
            <Eye size={16} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.watchlistText}>View Watchlist</Text>
          </Pressable>
          <Pressable 
            onPress={() => setWatchModalOpen(true)} 
            style={({ pressed }) => [styles.addWatchBtn, pressed && styles.addWatchBtnPressed]}
          >
            <Plus size={16} color="white" strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textTertiary} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search alerts..."
            placeholderTextColor={Colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptySub}>
              Watch a domain or vendor to get notified when risk changes.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable 
            onPress={() => onOpen(item)} 
            style={({ pressed }) => [
              styles.card, 
              !item.readAt && styles.cardUnread,
              pressed && styles.cardPressed
            ]}
          >
            <View style={styles.cardHeader}>
              <BadgePill badge={item.badge} size="small" />
              <Text style={styles.cardEntity} numberOfLines={1}>{item.entityKey}</Text>
              <Text style={styles.cardType}>({item.entityType})</Text>
            </View>
            
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardScore}>Score: {item.score}/100</Text>
              <Text style={styles.cardTime}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            
            <Text style={styles.cardMsg} numberOfLines={2}>
              {item.message}
            </Text>

            {!!item.topReasons?.length && (
              <View style={styles.reasonsContainer}>
                {item.topReasons.slice(0, 1).map((r, idx) => (
                  <Text key={idx} style={styles.reasonLine} numberOfLines={1}>
                    {r.key}) {r.summary}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.cardActions}>
              <Pressable 
                onPress={() => onShare(item)} 
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Share2 size={14} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={styles.actionBtnText}>Share</Text>
              </Pressable>
              <Pressable 
                onPress={() => onWatch(item)} 
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Eye size={14} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={styles.actionBtnText}>Watch</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <Modal
        visible={watchModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWatchModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setWatchModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Watchlist</Text>
              <Pressable onPress={() => setWatchModalOpen(false)} style={styles.modalCloseIcon}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
            <Text style={styles.modalDesc}>
              Enter a domain or paste a link to watch for risk changes.
            </Text>
            <TextInput
              value={watchInput}
              onChangeText={setWatchInput}
              placeholder="e.g. example.com or paste URL"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Pressable 
                style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.modalCancelBtnPressed]} 
                onPress={() => setWatchModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={({ pressed }) => [styles.modalConfirmBtn, pressed && styles.modalConfirmBtnPressed]} 
                onPress={onAddWatch}
              >
                <Text style={styles.modalConfirmText}>Add Watch</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  unreadBadge: {
    backgroundColor: Colors.highRisk,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700" as const,
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
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
  watchlistRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  watchlistBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  watchlistBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  watchlistText: {
    color: Colors.primary,
    fontWeight: "700" as const,
    fontSize: 14,
  },
  addWatchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  addWatchBtnPressed: {
    backgroundColor: Colors.primaryDark,
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
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
    paddingHorizontal: 20,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: `${Colors.primary}50`,
    backgroundColor: `${Colors.primary}08`,
  },
  cardPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardEntity: {
    flex: 1,
    color: Colors.text,
    fontWeight: "700" as const,
    fontSize: 14,
  },
  cardType: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardScore: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  cardTime: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  cardMsg: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  reasonsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reasonLine: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnPressed: {
    backgroundColor: Colors.cardHighlight,
  },
  actionBtnText: {
    color: Colors.textSecondary,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  modalCloseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: Colors.text,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelBtnPressed: {
    backgroundColor: Colors.cardHighlight,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: "600" as const,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  modalConfirmBtnPressed: {
    backgroundColor: Colors.primaryDark,
  },
  modalConfirmText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600" as const,
  },
});
