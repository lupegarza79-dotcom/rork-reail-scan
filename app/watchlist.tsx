import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  Switch,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Eye, ChevronLeft, X } from "lucide-react-native";
import {
  loadWatchlist,
  addWatch,
  toggleWatch,
  removeWatch,
  type WatchItem,
  type EntityType,
} from "../utils/alertsStore";
import Colors from "@/constants/colors";

const ENTITY_TYPES: EntityType[] = ["domain", "vendor", "creator", "link"];

export default function WatchlistScreen() {
  const router = useRouter();
  const [items, setItems] = useState<WatchItem[]>([]);
  const [type, setType] = useState<EntityType>("domain");
  const [key, setKey] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const arr = await loadWatchlist();
        if (active) setItems(arr);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const onAdd = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    const next = await addWatch(type, trimmed);
    setItems(next);
    setKey("");
    Alert.alert("Added", `${trimmed} added to watchlist.`);
  };

  const onToggle = async (id: string, enabled: boolean) => {
    const next = await toggleWatch(id, enabled);
    setItems(next);
  };

  const onRemove = async (id: string) => {
    const next = await removeWatch(id);
    setItems(next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="white" />
        </Pressable>
        <Text style={styles.title}>Watchlist</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.contentPadding}>
        <View style={styles.typeRow}>
          {ENTITY_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.chip, type === t && styles.chipActive]}
            >
              <Text style={styles.chipText}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.spacer} />

        <View style={styles.addRow}>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="Add domain or profile URL…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={onAdd} style={styles.addBtn}>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Eye size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyTitle}>No watch items yet</Text>
            <Text style={styles.emptySub}>
              Add a domain or vendor to get alerts when risk changes.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTop}>
                <Text style={styles.cardEntity}>{item.entityKey}</Text>{" "}
                <Text style={styles.cardType}>({item.entityType})</Text>
              </Text>
              <Text style={styles.cardSub}>
                Added: {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>

            <Switch
              value={item.alertsEnabled}
              onValueChange={(v) => onToggle(item.id, v)}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: Colors.primary }}
              thumbColor="white"
            />

            <Pressable onPress={() => onRemove(item.id)} style={styles.removeBtn}>
              <X size={16} color="white" />
            </Pressable>
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  placeholder: {
    width: 44,
  },
  contentPadding: {
    padding: 16,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: "rgba(120,180,255,0.18)",
    borderColor: "rgba(120,180,255,0.35)",
  },
  chipText: {
    color: "white",
    fontWeight: "900",
    opacity: 0.9,
  },
  spacer: {
    height: 10,
  },
  addRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  addBtn: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  addText: {
    color: "white",
    fontWeight: "900",
    opacity: 0.9,
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
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
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
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
});
