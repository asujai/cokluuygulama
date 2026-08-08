import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageRepository = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) {
        return defaultValue;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(`[storageRepository] Failed to read key "${key}":`, error);
      return defaultValue;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      await AsyncStorage.setItem(key, raw);
    } catch (error) {
      console.warn(`[storageRepository] Failed to write key "${key}":`, error);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(`[storageRepository] Failed to remove key "${key}":`, error);
    }
  },
};
