import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { STORAGE_KEYS } from './keys';
import { storageRepository } from './storageRepository';
import { getToolById, isToolEnabled, ToolDefinition } from '../../registry';

const MAX_RECENTS = 8;
const MAX_HISTORY = 50;

export interface OperationHistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  actionName?: string;
  timestamp: number;
  inputSummary?: string;
  outputSummary?: string;
  outputFileUri?: string;
  outputFileName?: string;
  outputFileType?: string;
  outputFileSize?: number;
  metadata?: Record<string, any>;
}

interface LibraryContextValue {
  favoriteIds: string[];
  favoriteTools: ToolDefinition[];
  recentIds: string[];
  recentTools: ToolDefinition[];
  historyEntries: OperationHistoryEntry[];
  isHydrated: boolean;
  firstUseSeen: boolean;
  toggleFavorite: (toolId: string) => Promise<void>;
  isFavorite: (toolId: string) => boolean;
  addRecent: (toolId: string) => Promise<void>;
  clearRecents: () => Promise<void>;
  addHistoryEntry: (
    entry: Omit<OperationHistoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
  ) => Promise<void>;
  clearHistory: () => Promise<void>;
  removeHistoryEntry: (id: string) => Promise<void>;
  dismissFirstUseHint: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

interface LibraryProviderProps {
  children: ReactNode;
}

export const LibraryProvider: React.FC<LibraryProviderProps> = ({ children }) => {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [historyEntries, setHistoryEntries] = useState<OperationHistoryEntry[]>([]);
  const [firstUseSeen, setFirstUseSeen] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate state from AsyncStorage on startup
  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const [savedFavorites, savedRecents, savedHistory, savedFirstUse] = await Promise.all([
          storageRepository.get<string[]>(STORAGE_KEYS.FAVORITES, []),
          storageRepository.get<string[]>(STORAGE_KEYS.RECENTS, []),
          storageRepository.get<OperationHistoryEntry[]>(STORAGE_KEYS.HISTORY, []),
          storageRepository.get<boolean>(STORAGE_KEYS.FIRST_USE_SEEN, false),
        ]);

        if (isMounted) {
          // Filter out stale or disabled tool IDs
          const validFavorites = Array.isArray(savedFavorites)
            ? savedFavorites.filter((id) => isToolEnabled(id))
            : [];

          const validRecents = Array.isArray(savedRecents)
            ? savedRecents.filter((id) => isToolEnabled(id)).slice(0, MAX_RECENTS)
            : [];

          const validHistory = Array.isArray(savedHistory)
            ? savedHistory.slice(0, MAX_HISTORY)
            : [];

          setFavoriteIds(validFavorites);
          setRecentIds(validRecents);
          setHistoryEntries(validHistory);
          setFirstUseSeen(!!savedFirstUse);
          setIsHydrated(true);
        }
      } catch (error) {
        console.warn('[LibraryProvider] Hydration error:', error);
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFavorite = useCallback(
    async (toolId: string) => {
      if (!isToolEnabled(toolId)) return;

      setFavoriteIds((prev) => {
        const isFav = prev.includes(toolId);
        const updated = isFav ? prev.filter((id) => id !== toolId) : [...prev, toolId];
        storageRepository.set(STORAGE_KEYS.FAVORITES, updated);
        return updated;
      });
    },
    []
  );

  const isFavorite = useCallback(
    (toolId: string): boolean => {
      return favoriteIds.includes(toolId);
    },
    [favoriteIds]
  );

  const addRecent = useCallback(
    async (toolId: string) => {
      if (!isToolEnabled(toolId)) return;

      setRecentIds((prev) => {
        const filtered = prev.filter((id) => id !== toolId);
        const updated = [toolId, ...filtered].slice(0, MAX_RECENTS);
        storageRepository.set(STORAGE_KEYS.RECENTS, updated);
        return updated;
      });
    },
    []
  );

  const clearRecents = useCallback(async () => {
    setRecentIds([]);
    await storageRepository.remove(STORAGE_KEYS.RECENTS);
  }, []);

  const addHistoryEntry = useCallback(
    async (
      entry: Omit<OperationHistoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
    ) => {
      const fullEntry: OperationHistoryEntry = {
        ...entry,
        id: entry.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: entry.timestamp || Date.now(),
      };

      setHistoryEntries((prev) => {
        const updated = [fullEntry, ...prev].slice(0, MAX_HISTORY);
        storageRepository.set(STORAGE_KEYS.HISTORY, updated);
        return updated;
      });
    },
    []
  );

  const clearHistory = useCallback(async () => {
    setHistoryEntries([]);
    await storageRepository.remove(STORAGE_KEYS.HISTORY);
  }, []);

  const removeHistoryEntry = useCallback(async (id: string) => {
    setHistoryEntries((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      storageRepository.set(STORAGE_KEYS.HISTORY, updated);
      return updated;
    });
  }, []);

  const dismissFirstUseHint = useCallback(async () => {
    setFirstUseSeen(true);
    await storageRepository.set(STORAGE_KEYS.FIRST_USE_SEEN, true);
  }, []);

  // Compute ToolDefinition lists for active/enabled favorites & recents
  const favoriteTools = useMemo(() => {
    return favoriteIds
      .map((id) => getToolById(id))
      .filter((tool): tool is ToolDefinition => tool !== undefined && tool.enabled);
  }, [favoriteIds]);

  const recentTools = useMemo(() => {
    return recentIds
      .map((id) => getToolById(id))
      .filter((tool): tool is ToolDefinition => tool !== undefined && tool.enabled);
  }, [recentIds]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      favoriteIds,
      favoriteTools,
      recentIds,
      recentTools,
      historyEntries,
      isHydrated,
      firstUseSeen,
      toggleFavorite,
      isFavorite,
      addRecent,
      clearRecents,
      addHistoryEntry,
      clearHistory,
      removeHistoryEntry,
      dismissFirstUseHint,
    }),
    [
      favoriteIds,
      favoriteTools,
      recentIds,
      recentTools,
      historyEntries,
      isHydrated,
      firstUseSeen,
      toggleFavorite,
      isFavorite,
      addRecent,
      clearRecents,
      addHistoryEntry,
      clearHistory,
      removeHistoryEntry,
      dismissFirstUseHint,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = (): LibraryContextValue => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
