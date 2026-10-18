import AsyncStorageModule from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type StorageValue = string | null;

const memoryStorage = new Map<string, string>();
let shouldUseMemoryFallback =
  Platform.OS === "web" && typeof window === "undefined";
let hasLoggedFallback = false;

const logFallback = (error: unknown) => {
  if (hasLoggedFallback) {
    return;
  }

  hasLoggedFallback = true;
  console.warn("AsyncStorage unavailable, falling back to in-memory storage.", error);
};

const withFallback = async <T>(operation: () => Promise<T>, fallback: () => T): Promise<T> => {
  if (shouldUseMemoryFallback) {
    return fallback();
  }

  try {
    return await operation();
  } catch (error) {
    shouldUseMemoryFallback = true;
    logFallback(error);
    return fallback();
  }
};

export const AsyncStorage = {
  getItem: (name: string): Promise<StorageValue> =>
    withFallback(
      () => AsyncStorageModule.getItem(name),
      () => memoryStorage.get(name) ?? null
    ),

  setItem: (name: string, value: string): Promise<void> =>
    withFallback(
      () => AsyncStorageModule.setItem(name, value),
      () => {
        memoryStorage.set(name, value);
      }
    ),

  removeItem: (name: string): Promise<void> =>
    withFallback(
      () => AsyncStorageModule.removeItem(name),
      () => {
        memoryStorage.delete(name);
      }
    ),
};
