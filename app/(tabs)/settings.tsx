import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings, Globe, Lock, Trash2, Info, Shield } from "lucide-react-native";
import { purgeOldHistory } from "@/utils/historyStore";
import { getDeviceId } from "@/utils/deviceId";
import Colors from "@/constants/colors";

type AutoDelete = "never" | "7" | "30";

const SETTINGS_KEY = "reail_settings_v1";

type ReailSettings = {
  language: "en" | "es";
  privacyMode: boolean;
  saveHistory: boolean;
  autoDelete: AutoDelete;
  advancedScan: boolean;
};

const DEFAULTS: ReailSettings = {
  language: "en",
  privacyMode: true,
  saveHistory: true,
  autoDelete: "never",
  advancedScan: false,
};

async function loadSettings(): Promise<ReailSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

async function saveSettings(s: ReailSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export default function SettingsTabScreen() {
  const [settings, setSettings] = useState<ReailSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      setLoaded(true);
      const did = await getDeviceId();
      setDeviceId(did);
      if (s.autoDelete === "7") await purgeOldHistory(7);
      if (s.autoDelete === "30") await purgeOldHistory(30);
    })();
  }, []);

  const update = async (patch: Partial<ReailSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    if (patch.autoDelete === "7") await purgeOldHistory(7);
    if (patch.autoDelete === "30") await purgeOldHistory(30);
  };

  const autoDeleteLabel = useMemo(() => {
    if (settings.autoDelete === "never") return "Never";
    if (settings.autoDelete === "7") return "7 days";
    return "30 days";
  }, [settings.autoDelete]);

  const onClearAll = () => {
    Alert.alert(
      "Clear all data?",
      "This will delete your local history, watchlist, and cached data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "reail_scans",
              "reail_history_v1",
              "reail_alerts_v1",
              "reail_watchlist_v1",
            ]);
            if (Platform.OS === "web") {
              alert("All local data cleared.");
            } else {
              Alert.alert("Done", "All local data cleared.");
            }
          },
        },
      ]
    );
  };

  const onResetDeviceId = () => {
    Alert.alert(
      "Reset Device ID?",
      "This will generate a new device ID. Your scan history may not sync.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("reail_device_id_v1");
            const newId = await getDeviceId();
            setDeviceId(newId);
          },
        },
      ]
    );
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Settings size={20} color={Colors.primary} strokeWidth={2} />
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>

          <View style={styles.row}>
            <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.primary}20` }]}>
              <Globe size={16} color={Colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Language</Text>
              <Text style={styles.rowSub}>English / Español</Text>
            </View>
            <Pressable
              onPress={() => update({ language: settings.language === "en" ? "es" : "en" })}
              style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
            >
              <Text style={styles.pillText}>{settings.language.toUpperCase()}</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.accent}20` }]}>
              <Lock size={16} color={Colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Privacy Mode</Text>
              <Text style={styles.rowSub}>Redacts sensitive data in history</Text>
            </View>
            <Switch
              value={settings.privacyMode}
              onValueChange={(v) => update({ privacyMode: v })}
              trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
              thumbColor="white"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.verified}20` }]}>
              <Shield size={16} color={Colors.verified} strokeWidth={2} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Save scan history</Text>
              <Text style={styles.rowSub}>Keeps scans on this device</Text>
            </View>
            <Switch
              value={settings.saveHistory}
              onValueChange={(v) => update({ saveHistory: v })}
              trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
              thumbColor="white"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.unverified}20` }]}>
              <Trash2 size={16} color={Colors.unverified} strokeWidth={2} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Auto-delete history</Text>
              <Text style={styles.rowSub}>{autoDeleteLabel}</Text>
            </View>
            <Pressable
              onPress={() => {
                const next: AutoDelete =
                  settings.autoDelete === "never"
                    ? "7"
                    : settings.autoDelete === "7"
                    ? "30"
                    : "never";
                update({ autoDelete: next });
              }}
              style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
            >
              <Text style={styles.pillText}>{autoDeleteLabel}</Text>
            </Pressable>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={[styles.rowIconWrap, { backgroundColor: `${Colors.accentSecondary}20` }]}>
              <Shield size={16} color={Colors.accentSecondary} strokeWidth={2} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Advanced scan</Text>
              <Text style={styles.rowSub}>Slower, deeper analysis</Text>
            </View>
            <Switch
              value={settings.advancedScan}
              onValueChange={(v) => update({ advancedScan: v })}
              trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRIVACY</Text>
          <View style={styles.privacyNote}>
            <Info size={14} color={Colors.textTertiary} strokeWidth={2} />
            <Text style={styles.privacyText}>
              REAiL analyzes public signals only. We do not access your private data, contacts, or files.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEVICE</Text>
          <View style={styles.deviceRow}>
            <Text style={styles.deviceLabel}>Device ID</Text>
            <Text style={styles.deviceValue} numberOfLines={1}>{deviceId}</Text>
          </View>
          <View style={styles.deviceActions}>
            <Pressable
              onPress={onResetDeviceId}
              style={({ pressed }) => [styles.deviceBtn, pressed && styles.deviceBtnPressed]}
            >
              <Text style={styles.deviceBtnText}>Reset Device ID</Text>
            </Pressable>
            <Pressable
              onPress={onClearAll}
              style={({ pressed }) => [styles.deviceBtn, styles.deviceBtnDanger, pressed && styles.deviceBtnDangerPressed]}
            >
              <Trash2 size={14} color={Colors.highRisk} strokeWidth={2} />
              <Text style={[styles.deviceBtnText, { color: Colors.highRisk }]}>Clear All Data</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerTitle}>Verification Disclaimer</Text>
            <Text style={styles.disclaimerText}>
              REAiL provides risk-based verification using public signals and automated analysis. It does not claim absolute truth. Results are risk-based, not definitive.
            </Text>
          </View>

          <View style={styles.rateLimitNote}>
            <Text style={styles.rateLimitTitle}>Rate Limits</Text>
            <Text style={styles.rateLimitText}>
              20 scans/hour • 5 reports/day • Fair use policy applies
            </Text>
          </View>

          <Text style={styles.footerText}>
            REAiL Scan v1.0 • Reality Verification Engine{"\n"}
            © 2024 REAiL Systems. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: "white",
    textAlign: "center" as const,
    marginTop: 100,
    opacity: 0.6,
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontWeight: "800" as const,
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    color: Colors.text,
    fontWeight: "600" as const,
    fontSize: 14,
  },
  rowSub: {
    color: Colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  pillText: {
    color: Colors.text,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  deviceLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  deviceValue: {
    color: Colors.textTertiary,
    fontSize: 11,
    maxWidth: 200,
  },
  deviceActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  deviceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deviceBtnPressed: {
    backgroundColor: Colors.backgroundTertiary,
  },
  deviceBtnDanger: {
    borderColor: `${Colors.highRisk}30`,
  },
  deviceBtnDangerPressed: {
    backgroundColor: `${Colors.highRisk}10`,
  },
  deviceBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  disclaimerCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  disclaimerTitle: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  disclaimerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  rateLimitNote: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  rateLimitTitle: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase" as const,
  },
  rateLimitText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  footerText: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: "center" as const,
    lineHeight: 18,
    paddingVertical: 16,
  },
});
