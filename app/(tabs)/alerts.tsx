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
  ShieldAlert,
  Info,
  ChevronRight,
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

function getSeverityColor(badge: string): string {
  if (badge === "HIGH_RISK") return Colors.highRisk;
  if (badge === "UNVERIFIED") return Colors.unverified;
  return Colors.verified;
}

function getWhyThisMatters(badge: string): string {
  if (badge === "HIGH_RISK") return "High-risk patterns detected. Exercise extreme caution.";
  if (badge === "UNVERIFIED") return "Not enough evidence to confirm authenticity.";
  return "Verified signals detected, but always stay aware.";
}

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
          const mapped: ReailAlert[] = remote.items.map((item: unknown) => {
          const x = item as Record<string, unknown>;
          return ({
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
          });
        });
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
    const list = alerts.slice().sort((a, b) => {
      if (!a.readAt && b.readAt) return -1;
      if (a.readAt && !b.readAt) return 1;
      const severityOrder = { HIGH_RISK: 0, UNVERIFIED: 1, VERIFIED: 2 };
      const aSev = severityOrder[a.badge as keyof typeof severityOrder] ?? 3;
      const bSev = severityOrder[b.badge as keyof typeof severityOrder] ?? 3;
      if (aSev !== bSev) return aSev - bSev;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    if (!query) return list;
    return list.filter((a) => {
      const hay = `${a.entityType} ${a.entityKey} ${a.badge} ${a.score} ${a.message}`.toLowerCase();
      return hay.includes(query);
    });
  }, [alerts, q]);

  const groupedAlerts = useMemo(() => {
    const highRisk = filtered.filter(a => a.badge === "HIGH_RISK");
    const unverified = filtered.filter(a => a.badge === "UNVERIFIED");
    const verified = filtered.filter(a => a.badge === "VERIFIED");
    
    const groups: { title: string; color: string; data: ReailAlert[] }[] = [];
    if (highRisk.length > 0) {
      groups.push({ title: "High Risk", color: Colors.highRisk, data: highRisk });
    }
    if (unverified.length > 0) {
      groups.push({ title: "Unverified", color: Colors.unverified, data: unverified });
    }
    if (verified.length > 0) {
      groups.push({ title: "Verified", color: Colors.verified, data: verified });
    }
    return groups;
  }, [filtered]);

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
      `${getBadgeLabel(a.badge)} • Risk Score: ${a.score}/100`,
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

  const renderAlertCard = (item: ReailAlert) => {
    const severityColor = getSeverityColor(item.badge);
    const whyMatters = getWhyThisMatters(item.badge);
    
    return (
      <Pressable 
        onPress={() => onOpen(item)} 
        style={({ pressed }) => [
          styles.card, 
          !item.readAt && styles.cardUnread,
          pressed && styles.cardPressed
        ]}
      >
        <View style={[styles.cardSeverityBar, { backgroundColor: severityColor }]} />
        
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <BadgePill badge={item.badge} size="small" />
            <Text style={styles.cardEntity} numberOfLines={1}>{item.entityKey}</Text>
            <ChevronRight size={16} color={Colors.textTertiary} strokeWidth={2} />
          </View>
          
          <View style={styles.cardMetaRow}>
            <Text style={[styles.cardScore, { color: severityColor }]}>
              {item.score}/100
            </Text>
            <Text style={styles.cardType}>({item.entityType})</Text>
            <Text style={styles.cardTime}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          
          <Text style={styles.cardMsg} numberOfLines={2}>
            {item.message}
          </Text>

          <View style={styles.whyMattersRow}>
            <Info size={12} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.whyMattersText}>{whyMatters}</Text>
          </View>

          <View style={styles.cardActions}>
            <Pressable 
              onPress={() => onWatch(item)} 
              style={({ pressed }) => [styles.actionBtnPrimary, pressed && styles.actionBtnPrimaryPressed]}
            >
              <Eye size={14} color="white" strokeWidth={2} />
              <Text style={styles.actionBtnPrimaryText}>Watch</Text>
            </Pressable>
            <Pressable 
              onPress={() => onShare(item)} 
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            >
              <Share2 size={14} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.actionBtnText}>Share</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Bell size={20} color={Colors.primary} strokeWidth={2} />
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
        data={groupedAlerts}
        keyExtractor={(group) => group.title}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <ShieldAlert size={48} color={Colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No active alerts</Text>
            <Text style={styles.emptySub}>
              Stay aware. Watch a domain or vendor{"\n"}to get notified when risk changes.
            </Text>
            <Pressable 
              onPress={() => setWatchModalOpen(true)}
              style={({ pressed }) => [styles.emptyBtn, pressed && styles.emptyBtnPressed]}
            >
              <Plus size={16} color="white" strokeWidth={2.5} />
              <Text style={styles.emptyBtnText}>Add to Watchlist</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: group }) => (
          <View style={styles.groupContainer}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupIndicator, { backgroundColor: group.color }]} />
              <Text style={[styles.groupTitle, { color: group.color }]}>{group.title}</Text>
              <Text style={styles.groupCount}>{group.data.length}</Text>
            </View>
            {group.data.map((alert) => (
              <View key={alert.id}>
                {renderAlertCard(alert)}
              </View>
            ))}
          </View>
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
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  groupIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  groupCount: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: "600" as const,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
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
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardSeverityBar: {
    width: 4,
  },
  cardUnread: {
    borderColor: `${Colors.primary}50`,
    backgroundColor: `${Colors.primary}08`,
  },
  cardPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  cardBody: {
    flex: 1,
    padding: 14,
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
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardScore: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  cardType: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  cardTime: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginLeft: "auto",
  },
  cardMsg: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  whyMattersRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: Colors.backgroundTertiary,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  whyMattersText: {
    flex: 1,
    color: Colors.textTertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryPressed: {
    backgroundColor: Colors.primaryDark,
  },
  actionBtnPrimaryText: {
    color: "white",
    fontWeight: "700" as const,
    fontSize: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
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
