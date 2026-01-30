import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";

export default function ToolsScreen() {
  const router = useRouter();

  const onShareToScan = () => {
    router.push("/share-tutorial");
  };

  const onUploadScreenshot = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      router.push(`/scanning?mediaUri=${encodeURIComponent(uri)}`);
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "More Options",
          headerStyle: { backgroundColor: "#0b0c10" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.content}>
        <Text style={styles.headline}>Scan Tools</Text>
        <Text style={styles.subhead}>
          Alternative ways to verify links and content
        </Text>

        <View style={styles.spacer} />

        <Pressable onPress={onShareToScan} style={styles.btn}>
          <Text style={styles.btnTitle}>SHARE TO SCAN</Text>
          <Text style={styles.btnDesc}>
            Share any link directly to REAiL from other apps
          </Text>
        </Pressable>

        <View style={styles.gap} />

        <Pressable onPress={onUploadScreenshot} style={styles.btn}>
          <Text style={styles.btnTitle}>UPLOAD SCREENSHOT</Text>
          <Text style={styles.btnDesc}>
            Scan a screenshot containing a link or product
          </Text>
        </Pressable>

        <View style={styles.spacer} />

        <Text style={styles.hint}>
          Tip: Use Share to Scan for the fastest verification workflow.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0c10",
  },
  content: {
    padding: 20,
  },
  headline: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },
  subhead: {
    color: "white",
    opacity: 0.7,
    marginTop: 6,
    fontSize: 14,
  },
  spacer: {
    height: 28,
  },
  gap: {
    height: 14,
  },
  btn: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  btnTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
  },
  btnDesc: {
    color: "white",
    opacity: 0.65,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: "white",
    opacity: 0.5,
    fontSize: 13,
    textAlign: "center",
  },
});
