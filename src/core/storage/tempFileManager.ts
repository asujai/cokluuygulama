import * as FileSystem from 'expo-file-system';
import { storageRepository } from './storageRepository';
import { STORAGE_KEYS } from './keys';

export interface TempFileRecord {
  id: string;
  uri: string;
  name: string;
  createdAt: number;
  toolId?: string;
  size?: number;
}

export const tempFileManager = {
  async getTempFiles(): Promise<TempFileRecord[]> {
    return storageRepository.get<TempFileRecord[]>(STORAGE_KEYS.TEMP_FILES, []);
  },

  async registerTempFile(params: {
    uri: string;
    name?: string;
    toolId?: string;
    size?: number;
  }): Promise<TempFileRecord> {
    const records = await this.getTempFiles();
    const filename = params.name || params.uri.split('/').pop() || `temp_${Date.now()}`;
    const newRecord: TempFileRecord = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      uri: params.uri,
      name: filename,
      createdAt: Date.now(),
      toolId: params.toolId,
      size: params.size,
    };

    const updated = [newRecord, ...records.filter((r) => r.uri !== params.uri)].slice(0, 100);
    await storageRepository.set(STORAGE_KEYS.TEMP_FILES, updated);
    return newRecord;
  },

  async deleteTempFile(uriOrId: string): Promise<boolean> {
    const records = await this.getTempFiles();
    const target = records.find((r) => r.id === uriOrId || r.uri === uriOrId);
    if (target) {
      try {
        const info = await FileSystem.getInfoAsync(target.uri);
        if (info.exists) {
          await FileSystem.deleteAsync(target.uri, { idempotent: true });
        }
      } catch (e) {
        console.warn('[tempFileManager] File deletion warning:', e);
      }
      const updated = records.filter((r) => r.id !== uriOrId && r.uri !== uriOrId);
      await storageRepository.set(STORAGE_KEYS.TEMP_FILES, updated);
      return true;
    }
    return false;
  },

  async cleanupTempFiles(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const records = await this.getTempFiles();
    const now = Date.now();
    const remaining: TempFileRecord[] = [];
    let deletedCount = 0;

    for (const record of records) {
      if (now - record.createdAt > olderThanMs) {
        try {
          const info = await FileSystem.getInfoAsync(record.uri);
          if (info.exists) {
            await FileSystem.deleteAsync(record.uri, { idempotent: true });
          }
        } catch (e) {
          console.warn('[tempFileManager] Cleanup deletion warning:', e);
        }
        deletedCount++;
      } else {
        remaining.push(record);
      }
    }

    await storageRepository.set(STORAGE_KEYS.TEMP_FILES, remaining);
    return deletedCount;
  },

  getTempDirectory(): string {
    const fs = FileSystem as any;
    return fs.cacheDirectory || fs.documentDirectory || '';
  },
};
