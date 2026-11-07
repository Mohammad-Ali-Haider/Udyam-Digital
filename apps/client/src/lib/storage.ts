import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const storage = {
  async get(key: string) {
    return Platform.OS === "web"
      ? typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(key)
      : AsyncStorage.getItem(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === "web") localStorage.setItem(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === "web") localStorage.removeItem(key);
    else await AsyncStorage.removeItem(key);
  },
};
const tokenKey = (base: string) =>
  `udyam.${Array.from(base)
    .map((c) => c.charCodeAt(0).toString(16))
    .join(".")}`;
export const tokens = {
  get: (base: string) => SecureStore.getItemAsync(tokenKey(base)),
  set: (base: string, token: string) =>
    SecureStore.setItemAsync(tokenKey(base), token),
  remove: (base: string) => SecureStore.deleteItemAsync(tokenKey(base)),
};
