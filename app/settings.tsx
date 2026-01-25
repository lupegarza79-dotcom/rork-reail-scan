// app/settings.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Switch, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { purgeOldHistory } from "../utils/historyStore";

type AutoDelete = "never" | "7" | "30";

const SETTINGS_KEY = "reail_settings_v1";

export type ReailSettings = {
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

export async function getSettings(): Promise<ReailSettings> {
  return loadSettings();
}

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<ReailSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      setLoaded(true);

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
    if (settings.autoDelete === "7") return "After 7 days";
    return "After 30 days";
  }, [settings.autoDelete]);

  const disclaimer =
    "REAiL provides risk-based verification using public signals and automated analysis. It does not claim absolute truth.";

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b0c10", justifyContent: "center" }}>
        <Text style={{ color: "white", textAlign: "center", opacity: 0.8 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0c10" }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.topBtn}>
          <Text style={styles.topBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ padding: 16 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Language</Text>
            <Text style={styles.rowSub}>English / Español</Text>
          </View>
          <Pressable
            onPress={() => update({ language: settings.language === "en" ? "es" : "en" })}
            style={styles.pillBtn}
          >
            <Text style={styles.pillText}>{settings.language.toUpperCase()}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Privacy Mode</Text>
            <Text style={styles.rowSub}>
              Redacts sensitive data in saved history.
            </Text>
          </View>
          <Switch
            value={settings.privacyMode}
            onValueChange={(v) => update({ privacyMode: v })}
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Save scan history</Text>
            <Text style={styles.rowSub}>Keeps scans on this device.</Text>
          </View>
          <Switch
            value={settings.saveHistory}
            onValueChange={(v) => update({ saveHistory: v })}
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
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
            style={styles.pillBtn}
          >
            <Text style={styles.pillText}>
              {settings.autoDelete === "never" ? "Never" : settings.autoDelete}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Advanced scan</Text>
            <Text style={styles.rowSub}>Slower, deeper analysis.</Text>
          </View>
          <Switch
            value={settings.advancedScan}
            onValueChange={(v) => update({ advancedScan: v })}
          />
        </View>

        <View style={styles.legalBox}>
          <Text style={styles.legalTitle}>Verification disclaimer</Text>
          <Text style={styles.legalText}>{disclaimer}</Text>
        </View>

        <Pressable
          onPress={() => {
            Alert.alert(
              "About REAiL",
              "Risk-based verification. Share to scan. Explainable reasons A–F."
            );
          }}
          style={styles.aboutBtn}
        >
          <Text style={styles.aboutText}>About</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles: Record<string, any> = {
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  topBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnText: { color: "white", fontSize: 16, opacity: 0.9 },
  title: { color: "white", fontWeight: "900", fontSize: 16 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  rowSub: { color: "white", opacity: 0.6, marginTop: 4, fontSize: 12 },

  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pillText: { color: "white", fontWeight: "900", opacity: 0.9 },

  legalBox: {
    marginTop: 18,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  legalTitle: { color: "white", fontWeight: "900", marginBottom: 6 },
  legalText: { color: "white", opacity: 0.75, fontSize: 12, lineHeight: 17 },

  aboutBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  aboutText: { color: "white", fontWeight: "900", opacity: 0.9 },
};
