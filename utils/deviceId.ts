import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "reail_device_id_v1";

function makeId() {
  return `dev_${Date.now()}_${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`;
}

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;
  const id = makeId();
  await AsyncStorage.setItem(KEY, id);
  return id;
}
